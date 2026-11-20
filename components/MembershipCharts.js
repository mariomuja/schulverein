const colors = ["#0d6efd", "#198754", "#fd7e14", "#6f42c1", "#d63384", "#20c997", "#dc3545"]

export default function MembershipCharts({ years }) {
  const width = 760
  const height = 240
  const pad = 28
  const maxAdded = Math.max(1, ...years.map((row) => row.added))
  const maxStock = Math.max(1, ...years.map((row) => row.stock))
  const slot = years.length ? (width - pad * 2) / years.length : 1

  const bars = years.map((row, index) => {
    const barHeight = (row.added / maxAdded) * (height - pad * 2)
    const x = pad + index * slot + slot * 0.2
    return {
      x,
      y: height - pad - barHeight,
      width: slot * 0.6,
      height: barHeight,
      color: colors[index % colors.length],
      label: String(row.year),
      added: row.added,
    }
  })

  const points = years.map((row, index) => {
    const x = pad + index * slot + slot / 2
    const y = height - pad - (row.stock / maxStock) * (height - pad * 2)
    return `${x},${y}`
  })

  return (
    <div className="row g-3">
      <div className="col-12 col-xl-6">
        <div className="card h-100">
          <div className="card-body">
            <h2 className="h6">Eintritte je Jahr</h2>
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Säulen der Eintritte je Jahr" className="w-100">
              {bars.map((bar) => (
                <g key={bar.label}>
                  <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.color} rx="3">
                    <title>{`${bar.label}: ${bar.added}`}</title>
                  </rect>
                  <text x={bar.x + bar.width / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#495057">
                    {bar.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
      <div className="col-12 col-xl-6">
        <div className="card h-100">
          <div className="card-body">
            <h2 className="h6">Bestand zum Jahresende</h2>
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Verlauf des Mitgliederbestands" className="w-100">
              <polyline points={points.join(" ")} fill="none" stroke="#0d6efd" strokeWidth="3" />
              {years.map((row, index) => {
                const [x, y] = points[index].split(",")
                return <circle key={row.year} cx={x} cy={y} r="4" fill={colors[index % colors.length]}><title>{`${row.year}: ${row.stock}`}</title></circle>
              })}
              {years.map((row, index) => (
                <text key={`${row.year}-label`} x={pad + index * slot + slot / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#495057">
                  {row.year}
                </text>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
