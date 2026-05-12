/** Label for bank account dropdowns when multiple rows can share the same `name`. */
export function bankAccountMenuLabel(acc) {
    if (!acc) return '';
    const name = String(acc.name || '').trim() || 'Bank';
    const digits = String(acc.accountNumber || '').replace(/\D/g, '');
    const mask = digits.length >= 4 ? `****${digits.slice(-4)}` : digits ? `****${digits}` : '';
    if (mask) return `${name} (${mask})`;
    const id = String(acc._id || '');
    const tail = id.length >= 6 ? id.slice(-6) : id;
    return tail ? `${name} (#${tail})` : name;
}

const looksLikeMongoId = (s) => typeof s === 'string' && /^[a-f\d]{24}$/i.test(s.trim());

/**
 * How this row will read in Payoneer / Transactions menus (draft while typing, or saved row).
 */
export function bankAccountListLabelDraft(name, accountNumber, existingId) {
    const id = existingId != null ? String(existingId).trim() : '';
    if (looksLikeMongoId(id)) {
        return bankAccountMenuLabel({ name, accountNumber, _id: id });
    }
    const trimmed = String(name ?? '').trim();
    if (!trimmed) return '—';
    const digits = String(accountNumber || '').replace(/\D/g, '');
    const mask = digits.length >= 4 ? `****${digits.slice(-4)}` : digits ? `****${digits}` : '';
    if (mask) return `${trimmed} (${mask})`;
    return `${trimmed} (add account # to distinguish same-name rows)`;
}
