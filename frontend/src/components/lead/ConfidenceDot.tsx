interface Props {
  confidence: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceDot({ confidence, size = 'md' }: Props) {
  // Calculate color based on confidence level
  let colorClass = "";
  
  if (confidence >= 0.8) {
    colorClass = "bg-emerald-500"; // High confidence
  } else if (confidence >= 0.5) {
    colorClass = "bg-amber-500"; // Medium confidence
  } else {
    colorClass = "bg-slate-500"; // Low confidence
  }
  
  // Size classes
  const sizeClass = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  }[size];
  
  return (
    <span 
      className={`inline-block ${sizeClass} rounded-full ${colorClass}`} 
      title={`${Math.round(confidence * 100)}% confidence`}
    />
  );
}
