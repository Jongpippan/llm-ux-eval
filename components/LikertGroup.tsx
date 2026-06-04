"use client";

export function LikertGroup({
  testidGroup,
  optionTestid,
  label,
  value,
  onChange,
}: {
  testidGroup: string;
  optionTestid: (v: number) => string;
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div>
        <b>{label}</b> <span className="muted small">(1=낮음 … 5=높음)</span>
      </div>
      <div className="likert" data-testid={testidGroup} role="radiogroup">
        {[1, 2, 3, 4, 5].map((v) => (
          <label key={v}>
            <input
              type="radio"
              name={testidGroup}
              value={v}
              checked={value === v}
              data-testid={optionTestid(v)}
              onChange={() => onChange(v)}
            />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}
