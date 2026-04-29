const bars = [28, 54, 34, 72, 46, 88, 38, 64, 50, 80, 42, 58, 36, 70, 48, 76];

export function FingerprintStrip() {
  return (
    <div className="flex h-20 items-end gap-1 rounded-lg border border-[#2A2A35] bg-[#171720] p-3" aria-label="SONARA fingerprint preview">
      {bars.map((height, index) => (
        <div
          key={`${height}-${index}`}
          className="w-full rounded-t bg-[#22D3EE]"
          style={{ height: `${height}%`, opacity: 0.42 + index / 40 }}
        />
      ))}
    </div>
  );
}
