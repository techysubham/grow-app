import mongoose from 'mongoose';

const ExtraExpenseSchema = new mongoose.Schema(
    {
        date: { type: Date, required: true },
        name: { type: String, required: true, trim: true },
        amount: { type: Number, required: true },
        paidBy: { type: String, required: true, trim: true },
        category: { type: String, trim: true, default: '' },
        remark: { type: String, trim: true, default: '' },
        paymentMethod: { type: String, trim: true, default: '' },
        bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },
    },
    { timestamps: true }
);

ExtraExpenseSchema.index({ date: -1 });
ExtraExpenseSchema.index({ category: 1 });
ExtraExpenseSchema.index({ paidBy: 1 });

export default mongoose.model('ExtraExpense', ExtraExpenseSchema);
