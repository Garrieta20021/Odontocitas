export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 28 : size === 'lg' ? 56 : 36
  return (
    <div
      className="rounded-xl bg-[#C17A5A] flex items-center justify-center flex-shrink-0"
      style={{ width: s, height: s }}
    >
      <svg width={s * 0.55} height={s * 0.55} viewBox="0 0 20 20" fill="none">
        <path d="M10 2C7 2 4 4.5 4 8c0 2 .8 3.5 2 4.5V17a1 1 0 002 0v-1h4v1a1 1 0 002 0v-4.5c1.2-1 2-2.5 2-4.5 0-3.5-3-6-6-6z" fill="white" />
      </svg>
    </div>
  )
}
