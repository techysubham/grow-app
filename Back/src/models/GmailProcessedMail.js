import mongoose from 'mongoose';

const GmailProcessedMailSchema = new mongoose.Schema(
    {
        messageId: { type: String, required: true, unique: true, index: true },
        from: { type: String, default: '' },
        subject: { type: String, default: '' },
        parsedDate: { type: Date },
        parsedAmount: { type: Number },
        parsedBankAccountName: { type: String, default: '' },
        transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }
    },
    { timestamps: true }
);

export default mongoose.model('GmailProcessedMail', GmailProcessedMailSchema);

