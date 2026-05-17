/**
 * Import transactions from export CSV into LOCAL MongoDB only (testing).
 *
 * Usage (from Back/):
 *   node tools/importTransactionsCsv.js "C:\path\to\transactions.csv"
 *   node tools/importTransactionsCsv.js --replace   # clear all transactions first
 *
 * Safety: refuses mongodb.net / azure hosts unless ALLOW_CSV_IMPORT=1
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import BankAccount from '../src/models/BankAccount.js';
import Transaction from '../src/models/Transaction.js';
import CreditCardName from '../src/models/CreditCardName.js';
import { bankAccountLedgerKey } from '../src/utils/bankAccountLedgerKey.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_ID = /^[a-f0-9]{24}$/i;

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertSafeToImport(uri) {
    const u = String(uri).toLowerCase();
    const looksRemote =
        u.includes('mongodb.net') ||
        u.includes('.azure.') ||
        u.includes('cosmos.azure.com');
    if (looksRemote && process.env.ALLOW_CSV_IMPORT !== '1') {
        console.error(
            'Blocked: MONGODB_URI looks like a remote/production database.\n' +
                'Use a local DB in Back/.env, or set ALLOW_CSV_IMPORT=1 only if you are sure.'
        );
        process.exit(1);
    }
}

function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];
    const headers = parseCsvRow(lines[0]);
    return lines.slice(1).map((line) => {
        const cells = parseCsvRow(line);
        const row = {};
        headers.forEach((h, i) => {
            row[h.trim()] = (cells[i] ?? '').trim();
        });
        return row;
    });
}

function parseCsvRow(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                cur += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            out.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur);
    return out;
}

function parseBankLabel(label) {
    const s = String(label || '').trim();
    const maskMatch = s.match(/^(.+?)\s*\(\*{4}(\d+)\)\s*$/);
    if (maskMatch) {
        return { name: maskMatch[1].trim(), mask: maskMatch[2], accountNumber: `LOCAL${maskMatch[2]}` };
    }
    const idMatch = s.match(/^(.+?)\s*\(#([a-f0-9]{6,})\)\s*$/i);
    if (idMatch) {
        return { name: idMatch[1].trim(), mask: '', accountNumber: `LOCAL-ID-${idMatch[2]}` };
    }
    return { name: s || 'Unknown Bank', mask: '', accountNumber: '' };
}

function parseSource(raw) {
    const s = String(raw || '').toLowerCase();
    return s === 'payoneer' ? 'PAYONEER' : 'MANUAL';
}

async function findOrCreateBankAccount(bankMeta, sellerIds) {
    const { name, mask, accountNumber } = bankMeta;
    let query = { name: new RegExp(`^${escapeRegex(name)}$`, 'i') };
    if (mask) {
        query = {
            $and: [
                { name: new RegExp(`^${escapeRegex(name)}$`, 'i') },
                {
                    $or: [
                        { accountNumber: new RegExp(`${escapeRegex(mask)}$`) },
                        { accountNumber: accountNumber }
                    ]
                }
            ]
        };
    }
    let bank = await BankAccount.findOne(query);
    const sellers = [...sellerIds].filter((id) => MONGO_ID.test(id)).join(', ');

    if (!bank) {
        bank = await BankAccount.create({
            name,
            accountNumber: accountNumber || (mask ? `LOCAL${mask}` : ''),
            ifscCode: '',
            sellers
        });
        return { bank, created: true };
    }

    const mergedSellers = new Set([
        ...String(bank.sellers || '')
            .split(/[,;]+/)
            .map((t) => t.trim())
            .filter(Boolean),
        ...sellerIds.filter((id) => MONGO_ID.test(id))
    ]);
    bank.sellers = [...mergedSellers].join(', ');
    if (!bank.accountNumber && accountNumber) bank.accountNumber = accountNumber;
    await bank.save();
    return { bank, created: false };
}

async function findOrCreateCreditCard(name) {
    const n = String(name || '').trim();
    if (!n) return null;
    let card = await CreditCardName.findOne({ name: n });
    if (!card) card = await CreditCardName.create({ name: n });
    return card;
}

function txnFingerprint({ date, bankId, type, amount }) {
    return `${date.toISOString().slice(0, 10)}|${bankId}|${type}|${amount.toFixed(2)}`;
}

async function main() {
    const args = process.argv.slice(2);
    const replace = args.includes('--replace');
    const csvArg = args.find((a) => !a.startsWith('--'));
    const defaultCsv = path.join(__dirname, 'local-fixtures', 'transactions_2026-05-17.csv');
    const csvPath = csvArg ? path.resolve(csvArg) : defaultCsv;

    if (!fs.existsSync(csvPath)) {
        console.error(`CSV not found: ${csvPath}`);
        process.exit(1);
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set in Back/.env');
        process.exit(1);
    }
    assertSafeToImport(uri);

    const text = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCsv(text);
    if (!rows.length) {
        console.error('No data rows in CSV');
        process.exit(1);
    }

    console.log(`Reading ${rows.length} rows from:\n  ${csvPath}`);
    console.log(`Database: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);

    await mongoose.connect(uri);

    try {
        if (replace) {
            const del = await Transaction.deleteMany({});
            console.log(`--replace: deleted ${del.deletedCount} existing transactions`);
        }

        const creditCardCache = new Map();
        const bankByLedgerKey = new Map();
        const sellerIdsByLedger = new Map();

        for (const row of rows) {
            const bankMeta = parseBankLabel(row['Bank Account']);
            const ledgerKey = bankAccountLedgerKey({
                name: bankMeta.name,
                accountNumber: bankMeta.accountNumber,
                _id: bankMeta.accountNumber
            });
            if (!sellerIdsByLedger.has(ledgerKey)) sellerIdsByLedger.set(ledgerKey, new Set());
            const store = String(row.Stores || '').trim();
            if (MONGO_ID.test(store)) sellerIdsByLedger.get(ledgerKey).add(store);
        }

        let banksCreated = 0;
        for (const [ledgerKey, sellerSet] of sellerIdsByLedger) {
            const sampleRow = rows.find((r) => {
                const m = parseBankLabel(r['Bank Account']);
                const k = bankAccountLedgerKey({
                    name: m.name,
                    accountNumber: m.accountNumber,
                    _id: m.accountNumber
                });
                return k === ledgerKey;
            });
            const bankMeta = parseBankLabel(sampleRow['Bank Account']);
            const { bank, created } = await findOrCreateBankAccount(bankMeta, [...sellerSet]);
            bankByLedgerKey.set(ledgerKey, bank);
            if (created) banksCreated++;
        }

        const sorted = [...rows].sort((a, b) => {
            const da = new Date(a.Date).getTime();
            const db = new Date(b.Date).getTime();
            if (da !== db) return da - db;
            return 0;
        });

        let inserted = 0;
        let skipped = 0;
        const seen = new Set();

        for (const row of sorted) {
            const bankMeta = parseBankLabel(row['Bank Account']);
            const ledgerKey = bankAccountLedgerKey({
                name: bankMeta.name,
                accountNumber: bankMeta.accountNumber,
                _id: bankMeta.accountNumber
            });
            const bank = bankByLedgerKey.get(ledgerKey);
            if (!bank) continue;

            const amount = parseFloat(row['Amount (INR)']);
            if (!Number.isFinite(amount)) continue;

            const transactionType = row.Type === 'Credit' ? 'Credit' : 'Debit';
            const txnDate = new Date(row.Date);
            txnDate.setHours(12, 0, 0, 0);
            const dayStart = new Date(row.Date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(row.Date);
            dayEnd.setHours(23, 59, 59, 999);

            const fp = txnFingerprint({
                date: txnDate,
                bankId: bank._id,
                type: transactionType,
                amount
            });
            if (seen.has(fp)) {
                skipped++;
                continue;
            }
            seen.add(fp);

            if (!replace) {
                const exists = await Transaction.findOne({
                    bankAccount: bank._id,
                    date: { $gte: dayStart, $lte: dayEnd },
                    transactionType,
                    amount
                });
                if (exists) {
                    skipped++;
                    continue;
                }
            }

            const source = parseSource(row.Source);
            let remark = String(row.Remark || '').trim();
            if (source === 'PAYONEER' && !remark) remark = 'Payoneer';

            let creditCardName;
            const cardLabel = String(row['Bank Account/Name'] || '').trim();
            if (transactionType === 'Debit' && cardLabel) {
                if (!creditCardCache.has(cardLabel)) {
                    creditCardCache.set(cardLabel, await findOrCreateCreditCard(cardLabel));
                }
                creditCardName = creditCardCache.get(cardLabel)?._id;
            }

            await Transaction.create({
                date: txnDate,
                bankAccount: bank._id,
                transactionType,
                amount,
                remark,
                source,
                creditCardName: creditCardName || undefined,
                sendEnabled: false
            });
            inserted++;
        }

        console.log('\nImport complete:');
        console.log(`  Bank accounts created: ${banksCreated}`);
        console.log(`  Bank accounts used:    ${bankByLedgerKey.size}`);
        console.log(`  Transactions added:  ${inserted}`);
        console.log(`  Skipped (duplicate): ${skipped}`);
        console.log(`  Credit cards:        ${creditCardCache.size}`);
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
