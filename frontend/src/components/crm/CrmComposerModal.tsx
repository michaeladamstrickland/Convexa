import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCrmActivity } from '../../api/crm';

interface Props {
  leadId: string;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CrmComposerModal({ leadId, onClose, onCreated }: Props) {
  const [type, setType] = useState<'note' | 'call.manual'>('note');
  const [text, setText] = useState('');
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      createCrmActivity({
        leadId,
        type,
        data: type === 'note' ? { text } : { summary: text },
      }),
    onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['crmActivity', leadId] });
      onCreated?.();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add CRM Activity</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              className="w-full rounded border px-2 py-1.5"
              value={type}
              onChange={(e) => setType(e.target.value as 'note' | 'call.manual')}
            >
              <option value="note">Note</option>
              <option value="call.manual">Manual Call Summary</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Content</label>
            <textarea
              className="h-28 w-full resize-y rounded border px-2 py-1.5"
              placeholder={type === 'note' ? 'Write a note...' : 'Summarize the call...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded px-3 py-1.5 text-sm" onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            onClick={() => mutate()}
            disabled={!text.trim() || isPending}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
