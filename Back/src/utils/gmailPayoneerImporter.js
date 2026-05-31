import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import PayoneerRecord from '../models/PayoneerRecord.js';
import BankAccount from '../models/BankAccount.js';
import Seller from '../models/Seller.js';
import Transaction from '../models/Transaction.js';
import GmailProcessedPayoneerMail from '../models/GmailProcessedPayoneerMail.js';
import {
    getConfiguredAllowedSenders,
    getConfiguredAllowedSubjects,
    parseFieldsFromMail,
    senderAllowed,
    subjectAllowed,
} from './gmailTransactionImporter.js';

const AMOUNT_TOLERANCE = 0.02;

function getImapConfig() {
    const host = String(process.env.GMAIL_IMAP_HOST || 'imap.gmail.com').trim();
    const port = Number(process.env.GMAIL_IMAP_PORT || 993);
    const secure = String(process.env.GMAIL_IMAP_SECURE || 'true').toLowerCase() !== 'false';
    const user = String(process.env.GMAIL_IMAP_USER || '').trim();
    const pass = String(process.env.GMAIL_IMAP_APP_PASSWORD || '').trim();
    return { host, port, secure, user, pass };
}

function normalizeMatchText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function amountsEqual(a, b, tolerance = AMOUNT_TOLERANCE) {
    const left = Number(a);
    const right = Number(b);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    return Math.abs(left - right) <= tolerance;
}

/** Match store from Payoneer greeting, e.g. "Ultimate Vision DEBAJYOTI PARIDA" → username "Ultimate Vision". */
export function resolveSellerFromGreeting(greetingName, sellers) {
    const greeting = normalizeMatchText(greetingName);
    if (!greeting || !Array.isArray(sellers) || !sellers.length) return null;

    let best = null;
    let bestLen = 0;

    for (const seller of sellers) {
        const candidates = [
            seller.user?.username,
            seller.user?.email,
        ].filter(Boolean);

        for (const raw of candidates) {
            const candidate = normalizeMatchText(raw);
            if (!candidate) continue;
            if (greeting.includes(candidate) || candidate.includes(greeting)) {
                if (candidate.length > bestLen) {
                    bestLen = candidate.length;
                    best = seller;
                }
            }
        }
    }

    return best;
}

async function loadSellersWithUsers() {
    return Seller.find({})
        .populate('user', 'username email')
        .select('_id user')
        .lean();
}

async function resolveBankAccountFromCustomerId(customerId) {
    const key = String(customerId || '').trim();
    if (!key) return null;
    return BankAccount.findOne({ payoneerId: key }).select('_id name payoneerId').lean();
}

async function findMatchingPayoneerRecord({ amountUsd, sellerId, bankAccountId }) {
    if (!sellerId || amountUsd == null) return null;

    const query = {
        store: sellerId,
        amount: {
            $gte: Number(amountUsd) - AMOUNT_TOLERANCE,
            $lte: Number(amountUsd) + AMOUNT_TOLERANCE,
        },
    };
    if (bankAccountId) query.bankAccount = bankAccountId;

    const records = await PayoneerRecord.find(query).sort({ paymentDate: -1 }).lean();
    if (!records.length) return null;

    const recordIds = records.map((r) => r._id);
    const processed = await GmailProcessedPayoneerMail.find({
        payoneerRecordId: { $in: recordIds },
    })
        .select('payoneerRecordId')
        .lean();
    const processedIds = new Set(processed.map((row) => String(row.payoneerRecordId)));

    const untouched = records.filter((r) => !processedIds.has(String(r._id)));
    return untouched[0] || records[0];
}

function applyPayoneerCalcs(record, { exchangeRate, bankDepositInr }) {
    if (exchangeRate == null) {
        return { ok: false, reason: 'Could not parse exchange rate from email' };
    }
    if (bankDepositInr == null) {
        return { ok: false, reason: 'Could not parse bank deposit (INR) from email' };
    }

    record.exchangeRate = exchangeRate;
    record.actualExchangeRate = Number((exchangeRate * 1.02).toFixed(4));
    record.bankDeposit = bankDepositInr;
    return { ok: true };
}

async function syncPayoneerTransaction(record) {
    await record.populate('bankAccount');
    const bankId = record.bankAccount?._id || record.bankAccount;
    await Transaction.findOneAndUpdate(
        { source: 'PAYONEER', sourceId: record._id },
        {
            date: record.paymentDate,
            bankAccount: bankId,
            amount: record.bankDeposit,
            transactionType: 'Credit',
            source: 'PAYONEER',
            sourceId: record._id,
            remark: 'Payoneer',
        },
        { upsert: true, setDefaultsOnInsert: true }
    );
}

/**
 * Apply parsed Payoneer withdrawal email fields to a matching Payoneer sheet row.
 * Match: USD amount + store name from greeting ("Dear …,").
 */
export async function applyParsedMailToPayoneerSheet({
    fields,
    messageId,
    from = '',
    subject = '',
    preview = false,
    sellers = null,
}) {
    const report = {
        status: 'skipped',
        skipReason: '',
        matched: false,
        updated: false,
        preview,
        payoneerRecordId: null,
        storeUsername: null,
        amountUsd: fields?.amountUsd ?? null,
        exchangeRate: fields?.exchangeRate ?? null,
        bankDepositInr: fields?.bankDepositInr ?? null,
        greetingName: fields?.greetingName || '',
    };

    if (!fields?.amountUsd) {
        report.skipReason = 'Could not parse Amount (USD) from email';
        return report;
    }
    if (fields.exchangeRate == null && fields.bankDepositInr == null) {
        report.skipReason = 'Could not parse exchange rate or bank deposit from email';
        return report;
    }
    if (!fields.greetingName) {
        report.skipReason = 'Could not parse store name from greeting (Dear …,)';
        return report;
    }

    const sellerList = sellers || (await loadSellersWithUsers());
    const seller = resolveSellerFromGreeting(fields.greetingName, sellerList);
    if (!seller) {
        report.skipReason = `No store matched greeting "${fields.greetingName}"`;
        return report;
    }

    report.storeUsername = seller.user?.username || seller.user?.email || '';

    const bankAccount = await resolveBankAccountFromCustomerId(fields.customerId);
    const recordDoc = await findMatchingPayoneerRecord({
        amountUsd: fields.amountUsd,
        sellerId: seller._id,
        bankAccountId: bankAccount?._id || null,
    });

    if (!recordDoc) {
        report.skipReason = `No Payoneer row for store "${report.storeUsername}" with amount $${fields.amountUsd}`;
        return report;
    }

    report.matched = true;
    report.payoneerRecordId = String(recordDoc._id);

    if (!amountsEqual(recordDoc.amount, fields.amountUsd)) {
        report.skipReason = 'Payoneer row amount did not match email USD amount';
        return report;
    }

    if (preview) {
        report.status = 'ready';
        return report;
    }

    const record = await PayoneerRecord.findById(recordDoc._id);
    if (!record) {
        report.skipReason = 'Matched Payoneer row was deleted before update';
        return report;
    }

    const calcs = applyPayoneerCalcs(record, fields);
    if (!calcs.ok) {
        report.skipReason = calcs.reason;
        return report;
    }

    await record.save();
    await syncPayoneerTransaction(record);

    await GmailProcessedPayoneerMail.create({
        messageId,
        from,
        subject,
        amountUsd: fields.amountUsd,
        greetingName: fields.greetingName,
        sellerUsername: report.storeUsername,
        exchangeRate: fields.exchangeRate ?? undefined,
        bankDeposit: fields.bankDepositInr ?? undefined,
        payoneerRecordId: record._id,
    });

    report.status = 'updated';
    report.updated = true;
    report.skipReason = '';
    return report;
}

async function parseMessageSource(msg) {
    const messageId = msg.envelope?.messageId || `uid-${msg.uid}`;
    const subject = msg.envelope?.subject || '';
    const fromText = (msg.envelope?.from || [])
        .map((f) => `${f.name || ''} <${f.address || ''}>`.trim())
        .join(', ');

    const parsedMail = await simpleParser(msg.source);
    const fields = parseFieldsFromMail({
        subject: subject || parsedMail.subject || '',
        text: String(parsedMail.text || '').trim(),
        html: String(parsedMail.html || '').trim(),
        date: parsedMail.date || msg.internalDate || new Date(),
    });

    return { messageId, subject, fromText, fields };
}

export async function applyPayoneerFieldsFromGmailUid(uid, { preview = false } = {}) {
    const numericUid = Number(uid);
    if (!Number.isFinite(numericUid) || numericUid <= 0) {
        throw new Error('Valid message uid is required.');
    }

    const { host, port, secure, user, pass } = getImapConfig();
    if (!user || !pass) {
        throw new Error('GMAIL_IMAP_USER and GMAIL_IMAP_APP_PASSWORD are required.');
    }

    const allowedSenders = getConfiguredAllowedSenders();
    const allowedSubjects = getConfiguredAllowedSubjects();
    const client = new ImapFlow({ host, port, secure, auth: { user, pass } });

    await client.connect();
    try {
        await client.mailboxOpen('INBOX');
        let message = null;
        for await (const msg of client.fetch(
            { uid: numericUid },
            { envelope: true, source: true, uid: true },
            { uid: true }
        )) {
            message = msg;
            break;
        }
        if (!message?.source) {
            throw new Error(`Message uid ${numericUid} not found in INBOX.`);
        }

        const { messageId, subject, fromText, fields } = await parseMessageSource(message);
        if (!senderAllowed(fromText, allowedSenders)) {
            return { status: 'skipped', skipReason: 'Sender not in GMAIL_IMPORT_ALLOWED_SENDERS' };
        }
        if (!subjectAllowed(subject, allowedSubjects)) {
            return { status: 'skipped', skipReason: 'Subject does not match GMAIL_IMPORT_ALLOWED_SUBJECTS' };
        }

        const already = await GmailProcessedPayoneerMail.findOne({ messageId }).select('_id').lean();
        if (already) {
            return { status: 'skipped', skipReason: 'Email already applied to Payoneer sheet' };
        }

        return applyParsedMailToPayoneerSheet({
            fields,
            messageId,
            from: fromText,
            subject,
            preview,
        });
    } finally {
        await client.logout();
    }
}

export async function importPayoneerFieldsFromGmail({ limit = 50, preview = false } = {}) {
    const { host, port, secure, user, pass } = getImapConfig();
    if (!user || !pass) {
        throw new Error('GMAIL_IMAP_USER and GMAIL_IMAP_APP_PASSWORD are required.');
    }

    const allowedSenders = getConfiguredAllowedSenders();
    const allowedSubjects = getConfiguredAllowedSubjects();
    const sellers = await loadSellersWithUsers();
    const client = new ImapFlow({ host, port, secure, auth: { user, pass } });

    const report = {
        scanned: 0,
        matched: 0,
        updated: 0,
        skipped: 0,
        preview,
        messages: [],
        errors: [],
    };

    await client.connect();
    try {
        await client.mailboxOpen('INBOX');
        let fetched = 0;
        for await (const msg of client.fetch({ seen: false }, { envelope: true, source: true, uid: true })) {
            if (fetched >= limit) break;
            fetched += 1;
            report.scanned += 1;

            try {
                const { messageId, subject, fromText, fields } = await parseMessageSource(msg);

                if (!senderAllowed(fromText, allowedSenders)) {
                    report.skipped += 1;
                    report.messages.push({
                        uid: msg.uid,
                        status: 'skipped',
                        skipReason: 'Sender not allowed',
                    });
                    continue;
                }
                if (!subjectAllowed(subject, allowedSubjects)) {
                    report.skipped += 1;
                    report.messages.push({
                        uid: msg.uid,
                        status: 'skipped',
                        skipReason: 'Subject not allowed',
                    });
                    continue;
                }

                const already = await GmailProcessedPayoneerMail.findOne({ messageId }).select('_id').lean();
                if (already) {
                    report.skipped += 1;
                    report.messages.push({
                        uid: msg.uid,
                        status: 'skipped',
                        skipReason: 'Already applied to Payoneer sheet',
                    });
                    continue;
                }

                const result = await applyParsedMailToPayoneerSheet({
                    fields,
                    messageId,
                    from: fromText,
                    subject,
                    preview,
                    sellers,
                });

                report.messages.push({
                    uid: msg.uid,
                    subject,
                    ...result,
                });

                if (result.matched) report.matched += 1;
                if (result.updated) report.updated += 1;
                if (result.status === 'skipped') report.skipped += 1;
            } catch (err) {
                report.errors.push(`UID ${msg.uid}: ${err.message}`);
                report.skipped += 1;
            }
        }
    } catch (err) {
        report.errors.push(err.message);
    } finally {
        await client.logout();
    }

    return report;
}
