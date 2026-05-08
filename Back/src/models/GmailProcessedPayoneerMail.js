import mongoose from 'mongoose';

const GmailProcessedPayoneerMailSchema = new mongoose.Schema(
    {
        messageId: { type: String, required: true, unique: true, index: true },
        from: { type: String, default: '' },
        subject: { type: String, default: '' },
        payoutId: { type: String, default: '' },
        exchangeRate: { type: Number },
        bankDeposit: { type: Number },
        payoneerRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayoneerRecord' }
    },
    { timestamps: true }
);

export default mongoose.model('GmailProcessedPayoneerMail', GmailProcessedPayoneerMailSchema);

