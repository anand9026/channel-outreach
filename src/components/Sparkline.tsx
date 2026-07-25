/**
 * Minimal SVG sparkline. Pure component, no dependencies.
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = 'var(--text)',
  fill = 'rgba(0,0,0,0.06)',
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
  fill?: string
}) {
  if (data.length === 0) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke="var(--border-strong)" />
      </svg>
    )
  }
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const stepX = data.length > 1 ? width / (data.length - 1) : 0
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const path = `M ${points[0]} L ${points.slice(1).join(' L ')}`
  const area = `${path} L ${width},${height} L 0,${height} Z`
  const last = data[data.length - 1]
  const lastX = (data.length - 1) * stepX
  const lastY = height - ((last - min) / range) * (height - 4) - 2

  return (
    <svg width={width} height={height} aria-hidden style={{ overflow: 'visible' }}>
      <path d={area} fill={fill} stroke="none" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  )
}
