import { ConfidenceDot } from "./ConfidenceDot";
import { PhoneIcon } from "lucide-react";

interface Props {
  phoneNumber?: string;
  confidence?: number;
  dnc?: boolean;
}

export function BestPhoneCell({ phoneNumber, confidence, dnc }: Props) {
  if (!phoneNumber) {
    return <span className="text-gray-400 text-sm">—</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <PhoneIcon size={14} className="text-gray-500" />
        <span className="text-sm">{phoneNumber}</span>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {dnc && <span className="text-xs text-rose-600 font-medium">DNC</span>}
        {confidence !== undefined && <ConfidenceDot confidence={confidence} size="sm" />}
      </div>
    </div>
  );
}
