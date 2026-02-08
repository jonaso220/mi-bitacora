export default function StatCard({ icon: Icon, label, value, color = "cyan" }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon">
        <Icon size={18} />
      </div>
      <div className="stat-content">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}
