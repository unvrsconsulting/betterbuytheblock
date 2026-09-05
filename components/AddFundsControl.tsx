import React, { useState } from 'react';
import { DollarSign, PlusCircle } from 'lucide-react';
import Button from './Button';

interface AddFundsControlProps {
  onAddFunds: (amount: number) => void;
  className?: string;
}

// Lets a business simulate topping up its account balance. Validates the entered
// amount client-side so a non-positive or non-numeric value is rejected inline
// without ever calling onAddFunds (and therefore without touching balance/history).
const AddFundsControl: React.FC<AddFundsControlProps> = ({ onAddFunds, className }) => {
  const [amountDraft, setAmountDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = amountDraft.trim();
    const amount = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a dollar amount greater than $0.');
      setConfirmation(null);
      return;
    }
    onAddFunds(amount);
    setError(null);
    setConfirmation(`$${amount.toFixed(2)} added to your balance.`);
    setAmountDraft('');
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DollarSign className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amountDraft}
            onChange={(e) => { setAmountDraft(e.target.value); setError(null); setConfirmation(null); }}
            placeholder="Amount to add"
            className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-40 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            aria-label="Amount to add"
          />
        </div>
        <Button type="submit" variant="outline" className="flex items-center gap-1.5 shrink-0 !px-3 !py-2">
          <PlusCircle className="w-4 h-4" /> Add Funds
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      {confirmation && <p className="text-xs text-green-600 mt-1.5">{confirmation}</p>}
    </form>
  );
};

export default AddFundsControl;
