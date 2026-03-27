import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#ec4899", "#eab308", "#06b6d4", "#ef4444"];

const DEFAULT_CATEGORIES = [
  { id: "fuel", name: "Fuel", icon: "⛽", limit: 0, color: COLORS[0] },
  { id: "clothing", name: "Clothing", icon: "👗", limit: 0, color: COLORS[1] },
  { id: "food", name: "Food & Dining", icon: "🍔", limit: 0, color: COLORS[2] },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatNPR(amount) {
  return `रू ${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function BudgetTracker() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(today));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [categories, setCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bt_categories")) || DEFAULT_CATEGORIES; } catch { return DEFAULT_CATEGORIES; }
  });
  const [monthData, setMonthData] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bt_monthData")) || {}; } catch { return {}; }
  });
  const [alerts, setAlerts] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", icon: "💡", limit: "" });
  const [newExpense, setNewExpense] = useState({ categoryId: "", amount: "", note: "", date: today.toISOString().split("T")[0] });
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");

  // Persist
  useEffect(() => { localStorage.setItem("bt_categories", JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem("bt_monthData", JSON.stringify(monthData)); }, [monthData]);

  const getMonthInfo = useCallback((mk = currentMonth) => {
    return monthData[mk] || { income: 0, expenses: [] };
  }, [monthData, currentMonth]);

  const currentInfo = getMonthInfo();

  // Compute totals
  const totalExpenses = currentInfo.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;
  const savings = currentInfo.income - totalExpenses;
  const savingsRate = currentInfo.income > 0 ? ((savings / currentInfo.income) * 100).toFixed(1) : 0;

  // Per-category spending
  const catSpending = categories.map(cat => {
    const spent = currentInfo.expenses?.filter(e => e.categoryId === cat.id).reduce((s, e) => s + Number(e.amount), 0) || 0;
    const pct = cat.limit > 0 ? (spent / cat.limit) * 100 : 0;
    return { ...cat, spent, pct };
  });

  // Check alerts
  useEffect(() => {
    const newAlerts = [];
    catSpending.forEach(cat => {
      if (cat.limit > 0 && cat.pct >= 80) {
        newAlerts.push({
          id: cat.id,
          type: cat.pct >= 100 ? "over" : "warn",
          msg: cat.pct >= 100
            ? `🚨 You've exceeded your ${cat.name} budget by ${formatNPR(cat.spent - cat.limit)}!`
            : `⚠️ ${cat.name} is at ${cat.pct.toFixed(0)}% of your limit (${formatNPR(cat.spent)} / ${formatNPR(cat.limit)})`
        });
      }
    });
    if (currentInfo.income > 0 && totalExpenses > currentInfo.income) {
      newAlerts.push({ id: "total", type: "over", msg: `🚨 Total spending exceeds income by ${formatNPR(totalExpenses - currentInfo.income)}!` });
    }
    setAlerts(newAlerts);
  }, [currentMonth, monthData, categories]);

  // Analytics: last 6 months
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
    const mk = getMonthKey(d);
    const info = getMonthInfo(mk);
    const exp = info.expenses?.reduce((s, e) => s + Number(e.amount), 0) || 0;
    return { name: MONTHS[d.getMonth()], income: info.income, expenses: exp, savings: info.income - exp };
  });

  const pieData = catSpending.filter(c => c.spent > 0).map(c => ({ name: c.name, value: c.spent, color: c.color }));

  function setIncome(val) {
    setMonthData(prev => ({ ...prev, [currentMonth]: { ...getMonthInfo(), income: Number(val) } }));
  }

  function addExpense() {
    if (!newExpense.categoryId || !newExpense.amount || Number(newExpense.amount) <= 0) return;
    const expense = { id: Date.now(), ...newExpense, amount: Number(newExpense.amount) };
    setMonthData(prev => ({
      ...prev,
      [currentMonth]: { ...getMonthInfo(), expenses: [...(getMonthInfo().expenses || []), expense] }
    }));
    setNewExpense({ categoryId: "", amount: "", note: "", date: today.toISOString().split("T")[0] });
    setShowAddExpense(false);
  }

  function deleteExpense(id) {
    setMonthData(prev => ({
      ...prev,
      [currentMonth]: { ...getMonthInfo(), expenses: getMonthInfo().expenses.filter(e => e.id !== id) }
    }));
  }

  function addCategory() {
    if (!newCat.name.trim()) return;
    const cat = {
      id: Date.now().toString(),
      name: newCat.name.trim(),
      icon: newCat.icon || "💡",
      limit: Number(newCat.limit) || 0,
      color: COLORS[categories.length % COLORS.length]
    };
    setCategories(prev => [...prev, cat]);
    setNewCat({ name: "", icon: "💡", limit: "" });
    setShowAddCategory(false);
  }

  function deleteCategory(id) {
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  function updateCatLimit(id, limit) {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, limit: Number(limit) } : c));
  }

  const prevMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setCurrentMonth(getMonthKey(d));
  };
  const nextMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    if (d <= today) setCurrentMonth(getMonthKey(d));
  };

  const monthLabel = (() => {
    const [y, m] = currentMonth.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  })();

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#0d0d0d", minHeight: "100vh", color: "#f5f5f5" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        input, select { background: #1e1e1e; border: 1px solid #2e2e2e; color: #f5f5f5; border-radius: 8px; padding: 10px 14px; font-size: 14px; width: 100%; outline: none; font-family: inherit; }
        input:focus, select:focus { border-color: #f97316; }
        button { cursor: pointer; font-family: inherit; }
        .tab-btn { background: none; border: none; color: #666; padding: 10px 18px; font-size: 13px; font-weight: 500; border-radius: 8px; transition: all 0.2s; }
        .tab-btn:hover { color: #f5f5f5; background: #1e1e1e; }
        .tab-btn.active { color: #f97316; background: #1e1e1e; }
        .card { background: #161616; border: 1px solid #222; border-radius: 16px; padding: 20px; }
        .badge-over { background: #7f1d1d; color: #fca5a5; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .badge-warn { background: #78350f; color: #fcd34d; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .badge-ok { background: #064e3b; color: #6ee7b7; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .pill-btn { background: #1e1e1e; border: 1px solid #2e2e2e; color: #ccc; border-radius: 8px; padding: 8px 14px; font-size: 13px; transition: all 0.2s; }
        .pill-btn:hover { border-color: #f97316; color: #f97316; }
        .prog-bar { height: 6px; background: #2a2a2a; border-radius: 99px; overflow: hidden; }
        .prog-fill { height: 100%; border-radius: 99px; transition: width 0.4s ease; }
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
        .modal { background: #161616; border: 1px solid #2e2e2e; border-radius: 20px; padding: 24px; width: 100%; max-width: 400px; }
        .del-btn { background: none; border: none; color: #555; font-size: 16px; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; }
        .del-btn:hover { color: #ef4444; background: #1f1111; }
        .stat-num { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; }
        .alert-box-over { background: #1f0707; border: 1px solid #7f1d1d; border-radius: 12px; padding: 12px 16px; font-size: 13px; color: #fca5a5; }
        .alert-box-warn { background: #1a1200; border: 1px solid #78350f; border-radius: 12px; padding: 12px 16px; font-size: 13px; color: #fcd34d; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#f97316", letterSpacing: "-0.5px" }}>BudgetFlow</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>Personal Finance Tracker</div>
        </div>
        {/* Month Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="pill-btn" onClick={prevMonth} style={{ padding: "6px 10px" }}>‹</button>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc", minWidth: 90, textAlign: "center" }}>{monthLabel}</div>
          <button className="pill-btn" onClick={nextMonth} style={{ padding: "6px 10px", opacity: currentMonth === getMonthKey(today) ? 0.3 : 1 }}>›</button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map(a => (
            <div key={a.id} className={a.type === "over" ? "alert-box-over" : "alert-box-warn"}>{a.msg}</div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: "1px solid #1a1a1a" }}>
        {["dashboard", "expenses", "categories", "analytics"].map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)} style={{ textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: "16px", maxWidth: 800, margin: "0 auto" }}>

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Income Card */}
            <div className="card" style={{ background: "linear-gradient(135deg, #1a0e00 0%, #161616 100%)", border: "1px solid #2d1a06" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Monthly Income</div>
                  {editingIncome ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="number" value={incomeInput} onChange={e => setIncomeInput(e.target.value)} placeholder="Enter income" style={{ width: 180, fontSize: 20, fontWeight: 700 }} autoFocus />
                      <button onClick={() => { setIncome(incomeInput); setEditingIncome(false); }} style={{ background: "#f97316", border: "none", color: "#fff", padding: "10px 16px", borderRadius: 8, fontWeight: 600 }}>Save</button>
                      <button onClick={() => setEditingIncome(false)} style={{ background: "#222", border: "none", color: "#888", padding: "10px 14px", borderRadius: 8 }}>✕</button>
                    </div>
                  ) : (
                    <div className="stat-num" style={{ color: "#f97316" }}>{formatNPR(currentInfo.income)}</div>
                  )}
                </div>
                {!editingIncome && (
                  <button className="pill-btn" onClick={() => { setIncomeInput(currentInfo.income || ""); setEditingIncome(true); }}>✏️ Edit</button>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Spent</div>
                <div className="stat-num" style={{ fontSize: 22, color: "#ef4444" }}>{formatNPR(totalExpenses)}</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Saved</div>
                <div className="stat-num" style={{ fontSize: 22, color: savings >= 0 ? "#10b981" : "#ef4444" }}>{formatNPR(savings)}</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Save Rate</div>
                <div className="stat-num" style={{ fontSize: 22, color: savingsRate >= 20 ? "#10b981" : savingsRate >= 0 ? "#eab308" : "#ef4444" }}>{savingsRate}%</div>
              </div>
            </div>

            {/* Budget progress */}
            <div className="card">
              <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 600, color: "#ccc" }}>Budget Overview</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {catSpending.map(cat => (
                  <div key={cat.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{cat.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{cat.name}</span>
                        {cat.limit > 0 && (
                          <span className={cat.pct >= 100 ? "badge-over" : cat.pct >= 80 ? "badge-warn" : "badge-ok"}>
                            {cat.pct >= 100 ? "Over!" : cat.pct >= 80 ? "Near limit" : "OK"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: "#999" }}>
                        {formatNPR(cat.spent)}{cat.limit > 0 ? ` / ${formatNPR(cat.limit)}` : ""}
                      </div>
                    </div>
                    {cat.limit > 0 && (
                      <div className="prog-bar">
                        <div className="prog-fill" style={{ width: `${Math.min(cat.pct, 100)}%`, background: cat.pct >= 100 ? "#ef4444" : cat.pct >= 80 ? "#eab308" : cat.color }} />
                      </div>
                    )}
                  </div>
                ))}
                {catSpending.length === 0 && <div style={{ color: "#555", fontSize: 13 }}>No categories yet. Add one in the Categories tab.</div>}
              </div>
            </div>

            {/* Quick add expense */}
            <button onClick={() => setShowAddExpense(true)} style={{ background: "#f97316", border: "none", color: "#fff", padding: "14px", borderRadius: 14, fontWeight: 700, fontSize: 15, width: "100%", letterSpacing: 0.5 }}>
              + Add Expense
            </button>
          </div>
        )}

        {/* EXPENSES */}
        {activeTab === "expenses" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800 }}>Expenses</div>
              <button onClick={() => setShowAddExpense(true)} className="pill-btn" style={{ background: "#f97316", border: "none", color: "#fff", fontWeight: 600 }}>+ Add</button>
            </div>
            {(!currentInfo.expenses || currentInfo.expenses.length === 0) ? (
              <div className="card" style={{ textAlign: "center", padding: 40, color: "#555" }}>No expenses logged for {monthLabel}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...currentInfo.expenses].reverse().map(exp => {
                  const cat = categories.find(c => c.id === exp.categoryId);
                  return (
                    <div key={exp.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: cat?.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{cat?.icon || "💸"}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{cat?.name || "Unknown"}</div>
                        <div style={{ fontSize: 12, color: "#555" }}>{exp.note || "—"} · {exp.date}</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#f97316" }}>{formatNPR(exp.amount)}</div>
                      <button className="del-btn" onClick={() => deleteExpense(exp.id)}>🗑</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CATEGORIES */}
        {activeTab === "categories" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800 }}>Categories</div>
              <button onClick={() => setShowAddCategory(true)} className="pill-btn" style={{ background: "#f97316", border: "none", color: "#fff", fontWeight: 600 }}>+ Add</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {categories.map(cat => (
                <div key={cat.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{cat.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{cat.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#666" }}>Budget limit रू</span>
                      <input type="number" defaultValue={cat.limit || ""} placeholder="No limit" onBlur={e => updateCatLimit(cat.id, e.target.value)} style={{ width: 120, padding: "5px 10px", fontSize: 13 }} />
                    </div>
                  </div>
                  <button className="del-btn" onClick={() => deleteCategory(cat.id)}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {activeTab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800 }}>Analytics</div>

            {/* Income vs Expenses chart */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Income vs Expenses (6 Months)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={last6} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 10 }} labelStyle={{ color: "#ccc" }} formatter={(v) => [formatNPR(v)]} />
                  <Bar dataKey="income" fill="#f97316" radius={[4,4,0,0]} name="Income" />
                  <Bar dataKey="expenses" fill="#3b82f6" radius={[4,4,0,0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Savings trend */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Savings Trend</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={last6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2e2e2e", borderRadius: 10 }} formatter={(v) => [formatNPR(v)]} />
                  <Line type="monotone" dataKey="savings" stroke="#10b981" strokeWidth={2.5} dot={{ fill: "#10b981", r: 4 }} name="Savings" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Spending breakdown pie */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Spending Breakdown — {monthLabel}</div>
              {pieData.length > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    {pieData.map((d, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                          <span style={{ fontSize: 13 }}>{d.name}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{totalExpenses > 0 ? ((d.value / totalExpenses) * 100).toFixed(0) : 0}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: 20 }}>No spending data for this month</div>
              )}
            </div>

            {/* Summary stats */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, color: "#888", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>Month Summary — {monthLabel}</div>
              {[
                { label: "Total Income", val: formatNPR(currentInfo.income), color: "#f97316" },
                { label: "Total Spent", val: formatNPR(totalExpenses), color: "#3b82f6" },
                { label: "Net Savings", val: formatNPR(savings), color: savings >= 0 ? "#10b981" : "#ef4444" },
                { label: "Savings Rate", val: `${savingsRate}%`, color: "#a855f7" },
                { label: "No. of Transactions", val: currentInfo.expenses?.length || 0, color: "#ccc" },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1e1e1e" }}>
                  <span style={{ fontSize: 14, color: "#777" }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="modal-bg" onClick={() => setShowAddExpense(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Add Expense</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <select value={newExpense.categoryId} onChange={e => setNewExpense(p => ({ ...p, categoryId: e.target.value }))}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <input type="number" placeholder="Amount (रू)" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} />
              <input type="text" placeholder="Note (optional)" value={newExpense.note} onChange={e => setNewExpense(p => ({ ...p, note: e.target.value }))} />
              <input type="date" value={newExpense.date} onChange={e => setNewExpense(p => ({ ...p, date: e.target.value }))} />
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAddExpense(false)} style={{ flex: 1, background: "#1e1e1e", border: "1px solid #2e2e2e", color: "#888", padding: "12px", borderRadius: 10, fontWeight: 600 }}>Cancel</button>
                <button onClick={addExpense} style={{ flex: 2, background: "#f97316", border: "none", color: "#fff", padding: "12px", borderRadius: 10, fontWeight: 700 }}>Add Expense</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="modal-bg" onClick={() => setShowAddCategory(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 20 }}>New Category</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="text" placeholder="Icon (emoji)" value={newCat.icon} onChange={e => setNewCat(p => ({ ...p, icon: e.target.value }))} style={{ width: 80, textAlign: "center", fontSize: 22 }} maxLength={2} />
                <input type="text" placeholder="Category name" value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} />
              </div>
              <input type="number" placeholder="Monthly budget limit (रू, optional)" value={newCat.limit} onChange={e => setNewCat(p => ({ ...p, limit: e.target.value }))} />
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAddCategory(false)} style={{ flex: 1, background: "#1e1e1e", border: "1px solid #2e2e2e", color: "#888", padding: "12px", borderRadius: 10, fontWeight: 600 }}>Cancel</button>
                <button onClick={addCategory} style={{ flex: 2, background: "#f97316", border: "none", color: "#fff", padding: "12px", borderRadius: 10, fontWeight: 700 }}>Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
