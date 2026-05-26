import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/Dashboard.jsx");const useMemo = __vite__cjsImport0_react["useMemo"]; const useState = __vite__cjsImport0_react["useState"]; const useEffect = __vite__cjsImport0_react["useEffect"];const _jsxDEV = __vite__cjsImport10_react_jsxDevRuntime["jsxDEV"]; const _Fragment = __vite__cjsImport10_react_jsxDevRuntime["Fragment"];import __vite__cjsImport0_react from "/node_modules/.vite/deps/react.js?v=d0fa5684";
import { Link, useNavigate } from "/node_modules/.vite/deps/react-router-dom.js?v=d0fa5684";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, IndianRupee, MessageCircle, Phone, Plus, Search, Users, Wallet, Zap } from "/node_modules/.vite/deps/lucide-react.js?v=d0fa5684";
import { toast } from "/node_modules/.vite/deps/react-toastify.js?v=d0fa5684";
import { addOne, increment, serverTimestamp, updateOne } from "/src/lib/data.js";
import useRealtime from "/src/hooks/useRealtime.js";
import EmptyState from "/src/components/EmptyState.jsx";
import { borrowerStatus, fmtDate, money, openWhatsApp, overdueDays, stepDays, todayISO, addDays, whatsappReminder, whatsappReceipt } from "/src/lib/finance.js";
import { defaultAvatar } from "/src/lib/photos.js";
import { generateReceiptHTML, shareReceiptAsImage } from "/src/lib/reports.js";
var _jsxFileName = "D:/SGMI-KK LENDMATE/src/pages/Dashboard.jsx";
import __vite__cjsImport10_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=d0fa5684";
var _s = $RefreshSig$();
const isDueToday = (b, todayStr) => {
	if (borrowerStatus(b) === "Completed") return false;
	if (!b.startDate || Number(b.pendingAmount || 0) <= 0) return false;
	const step = stepDays(b.financeType || "Daily");
	const duration = Number(b.duration || 0);
	const lastDue = duration > 0 ? addDays(b.startDate, (duration - 1) * step) : b.startDate;
	if (lastDue < todayStr) return true;
	for (let i = 0; i < duration; i++) {
		const d = addDays(b.startDate, i * step);
		if (d === todayStr) return true;
		if (d > todayStr) break;
	}
	return false;
};
const fmtTime = (ts) => {
	const d = ts?.toDate ? ts.toDate() : ts?._t ? new Date(ts._t) : null;
	if (!d) return "";
	return d.toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true
	});
};
export default function Dashboard() {
	_s();
	const navigate = useNavigate();
	const [dashTab, setDashTab] = useState("today");
	const [search, setSearch] = useState("");
	const [allExpanded, setAllExpanded] = useState(false);
	const [lastQuickCollect, setLastQuickCollect] = useState(null);
	const { data: borrowers, loading } = useRealtime("borrowers", { orderBy: ["createdAt", "desc"] });
	const { data: rawCollections, loading: collectionsLoading } = useRealtime("collections");
	const collections = useMemo(() => {
		return [...rawCollections].sort((a, b) => {
			const tA = a.paidAt?.seconds || 0;
			const tB = b.paidAt?.seconds || 0;
			return tB - tA;
		});
	}, [rawCollections]);
	const [todayStr, setTodayStr] = useState(todayISO());
	useEffect(() => {
		const updateDate = () => setTodayStr(todayISO());
		window.addEventListener("focus", updateDate);
		window.addEventListener("visibilitychange", updateDate);
		const interval = setInterval(updateDate, 6e4);
		return () => {
			window.removeEventListener("focus", updateDate);
			window.removeEventListener("visibilitychange", updateDate);
			clearInterval(interval);
		};
	}, []);
	// Simple quick collect — no slot allocation, just records a payment
	const quickCollect = async (b) => {
		const emi = Number(b.emi || 0);
		const pending = Number(b.pendingAmount || 0);
		if (emi <= 0 || pending <= 0) return;
		const amt = Math.min(emi, pending);
		try {
			await addOne("collections", {
				borrowerId: b.id,
				borrowerName: b.fullName,
				totalCollected: amt,
				collectedDate: todayStr,
				collectorName: "Admin",
				notes: "Quick collect",
				paidAt: serverTimestamp()
			});
			const newPending = Math.max(0, pending - amt);
			await updateOne("borrowers", b.id, {
				paidAmount: increment(amt),
				pendingAmount: newPending,
				updatedAt: serverTimestamp()
			});
			toast.success(`Collected ${money(amt)} from ${b.fullName}`);
			setLastQuickCollect({
				borrower: b,
				amt,
				remaining: newPending,
				date: todayStr
			});
		} catch (e) {
			toast.error(e.message);
		}
	};
	// Derived data
	const paidTodayIds = useMemo(() => {
		const ids = new Set();
		collections.forEach((c) => {
			const d = c.collectedDate || c.paidAt?.toDate?.()?.toISOString?.().slice(0, 10);
			if (d === todayStr) ids.add(c.borrowerId);
		});
		return ids;
	}, [collections, todayStr]);
	const todayCollMap = useMemo(() => {
		const m = {};
		collections.forEach((c) => {
			const d = c.collectedDate || c.paidAt?.toDate?.()?.toISOString?.().slice(0, 10);
			if (d === todayStr) {
				if (!m[c.borrowerId]) m[c.borrowerId] = [];
				m[c.borrowerId].push(c);
			}
		});
		return m;
	}, [collections, todayStr]);
	const activeBorrowers = useMemo(() => borrowers.filter((b) => borrowerStatus(b) !== "Completed" && borrowerStatus(b) !== "Overpaid"), [borrowers]);
	const excessBorrowers = useMemo(() => borrowers.filter((b) => borrowerStatus(b) === "Overpaid").filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())), [borrowers, search]);
	// Overdue borrowers (repayment period ended but still pending)
	const overdueBorrowers = useMemo(() => borrowers.filter((b) => borrowerStatus(b) === "Overdue").filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())), [borrowers, search]);
	const pendingToday = useMemo(() => activeBorrowers.filter((b) => isDueToday(b, todayStr) && !paidTodayIds.has(b.id)).filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())), [
		activeBorrowers,
		paidTodayIds,
		todayStr,
		search
	]);
	const paidToday = useMemo(() => activeBorrowers.filter((b) => paidTodayIds.has(b.id)).filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())), [
		activeBorrowers,
		paidTodayIds,
		search
	]);
	const allRows = useMemo(() => borrowers.filter((b) => dashTab === "all" ? borrowerStatus(b) !== "Completed" : borrowerStatus(b) === "Completed").filter((b) => `${b.fullName} ${b.phone}`.toLowerCase().includes(search.toLowerCase())), [
		borrowers,
		dashTab,
		search
	]);
	const collectedToday = collections.filter((c) => (c.collectedDate || c.paidAt?.toDate?.()?.toISOString?.().slice(0, 10)) === todayStr).reduce((s, c) => s + Number(c.totalCollected || 0), 0);
	const activeCount = activeBorrowers.length;
	const totalPending = borrowers.reduce((s, b) => s + Number(b.pendingAmount || 0), 0);
	return /* @__PURE__ */ _jsxDEV("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ _jsxDEV("div", {
				className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ _jsxDEV(SummaryCard, {
						icon: /* @__PURE__ */ _jsxDEV(Users, { size: 16 }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 147,
							columnNumber: 28
						}, this),
						label: "Active",
						value: activeCount,
						color: "bg-primary-50 text-primary-700"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 147,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ _jsxDEV(SummaryCard, {
						icon: /* @__PURE__ */ _jsxDEV(IndianRupee, { size: 16 }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 148,
							columnNumber: 28
						}, this),
						label: "Total Pending",
						value: money(totalPending),
						color: "bg-red-50 text-red-700"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 148,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ _jsxDEV(SummaryCard, {
						icon: /* @__PURE__ */ _jsxDEV(Wallet, { size: 16 }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 149,
							columnNumber: 28
						}, this),
						label: "Collected Today",
						value: money(collectedToday),
						color: "bg-green-50 text-green-700"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 149,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ _jsxDEV(SummaryCard, {
						icon: /* @__PURE__ */ _jsxDEV(Clock, { size: 16 }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 150,
							columnNumber: 28
						}, this),
						label: "Pending Today",
						value: pendingToday.length,
						color: pendingToday.length > 0 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 150,
						columnNumber: 9
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 146,
				columnNumber: 7
			}, this),
			pendingToday.length + paidToday.length > 0 && /* @__PURE__ */ _jsxDEV("div", {
				className: "card !py-3",
				children: [/* @__PURE__ */ _jsxDEV("div", {
					className: "flex items-center justify-between text-xs font-bold text-slate-600 mb-2",
					children: [/* @__PURE__ */ _jsxDEV("span", { children: "Today's Progress" }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 157,
						columnNumber: 13
					}, this), /* @__PURE__ */ _jsxDEV("span", {
						className: "text-green-700",
						children: [
							paidToday.length,
							" / ",
							pendingToday.length + paidToday.length,
							" collected"
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 158,
						columnNumber: 13
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 156,
					columnNumber: 11
				}, this), /* @__PURE__ */ _jsxDEV("div", {
					className: "h-2.5 w-full rounded-full bg-slate-100 overflow-hidden",
					children: /* @__PURE__ */ _jsxDEV("div", {
						className: "h-2.5 rounded-full bg-green-500 transition-all",
						style: { width: `${Math.round(paidToday.length / Math.max(1, pendingToday.length + paidToday.length) * 100)}%` }
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 161,
						columnNumber: 13
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 160,
					columnNumber: 11
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 155,
				columnNumber: 9
			}, this),
			/* @__PURE__ */ _jsxDEV("div", {
				className: "card space-y-3",
				children: [/* @__PURE__ */ _jsxDEV("div", {
					className: "flex items-center gap-2 rounded-xl border border-slate-200 px-3",
					children: [/* @__PURE__ */ _jsxDEV(Search, {
						size: 15,
						className: "shrink-0 text-slate-400"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 170,
						columnNumber: 11
					}, this), /* @__PURE__ */ _jsxDEV("input", {
						className: "w-full bg-transparent py-2.5 text-sm outline-none",
						placeholder: "Search by name or phone...",
						value: search,
						onChange: (e) => setSearch(e.target.value)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 171,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 169,
					columnNumber: 9
				}, this), /* @__PURE__ */ _jsxDEV("div", {
					className: "flex items-center gap-2 flex-wrap",
					children: [
						/* @__PURE__ */ _jsxDEV("button", {
							onClick: () => setDashTab("today"),
							className: dashTab === "today" ? "btn-primary" : "btn-soft",
							children: "Today"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 174,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ _jsxDEV("button", {
							onClick: () => setDashTab("overdue"),
							className: dashTab === "overdue" ? "btn-primary" : "btn-soft",
							children: ["Overdue ", overdueBorrowers.length > 0 && /* @__PURE__ */ _jsxDEV("span", {
								className: "ml-1 rounded-full bg-red-100 px-1.5 text-[10px] font-black text-red-700",
								children: overdueBorrowers.length
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 176,
								columnNumber: 53
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 175,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ _jsxDEV("button", {
							onClick: () => setDashTab("excess"),
							className: dashTab === "excess" ? "btn-primary" : "btn-soft",
							children: ["Excess Paid ", excessBorrowers.length > 0 && /* @__PURE__ */ _jsxDEV("span", {
								className: "ml-1 rounded-full bg-green-100 px-1.5 text-[10px] font-black text-green-700",
								children: excessBorrowers.length
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 179,
								columnNumber: 56
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 178,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ _jsxDEV("button", {
							onClick: () => setDashTab("all"),
							className: dashTab === "all" ? "btn-primary" : "btn-soft",
							children: "All Active"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 181,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ _jsxDEV("button", {
							onClick: () => setDashTab("closed"),
							className: dashTab === "closed" ? "btn-primary" : "btn-soft",
							children: "Closed"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 182,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ _jsxDEV(Link, {
							to: "/borrowers/new",
							className: "btn-primary ml-auto",
							children: [/* @__PURE__ */ _jsxDEV(Plus, { size: 15 }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 183,
								columnNumber: 69
							}, this), " Add"]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 183,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 173,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 168,
				columnNumber: 7
			}, this),
			loading ? /* @__PURE__ */ _jsxDEV("div", { className: "skeleton h-32" }, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 187,
				columnNumber: 18
			}, this) : /* @__PURE__ */ _jsxDEV(_Fragment, { children: [
				lastQuickCollect && /* @__PURE__ */ _jsxDEV("div", {
					className: "card border-2 border-green-200 bg-green-50 space-y-2",
					children: [
						/* @__PURE__ */ _jsxDEV("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ _jsxDEV("p", {
								className: "text-sm font-black text-green-800",
								children: ["✓ Collected from ", lastQuickCollect.borrower.fullName]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 193,
								columnNumber: 17
							}, this), /* @__PURE__ */ _jsxDEV("button", {
								onClick: () => setLastQuickCollect(null),
								className: "text-green-600",
								children: /* @__PURE__ */ _jsxDEV("span", {
									className: "text-lg leading-none",
									children: "×"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 194,
									columnNumber: 94
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 194,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 192,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ _jsxDEV("p", {
							className: "text-xs text-green-700",
							children: [
								money(lastQuickCollect.amt),
								" • Balance: ",
								money(lastQuickCollect.remaining),
								" • ",
								lastQuickCollect.borrower.phone
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 196,
							columnNumber: 15
						}, this),
						/* @__PURE__ */ _jsxDEV("div", {
							className: "grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ _jsxDEV("button", {
								onClick: () => {
									const html = generateReceiptHTML({
										borrower: lastQuickCollect.borrower,
										amount: lastQuickCollect.amt,
										date: fmtDate(lastQuickCollect.date),
										remaining: lastQuickCollect.remaining,
										collectorName: "Admin"
									});
									shareReceiptAsImage(html, lastQuickCollect.borrower.phone, whatsappReceipt({
										...lastQuickCollect.borrower,
										pendingAmount: lastQuickCollect.remaining
									}, lastQuickCollect.amt, lastQuickCollect.date));
								},
								className: "flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2 text-sm font-black text-white hover:bg-green-700",
								children: [/* @__PURE__ */ _jsxDEV(MessageCircle, { size: 14 }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 201,
									columnNumber: 19
								}, this), " WhatsApp Receipt"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 198,
								columnNumber: 17
							}, this), /* @__PURE__ */ _jsxDEV("button", {
								onClick: () => setLastQuickCollect(null),
								className: "rounded-xl border border-green-200 py-2 text-sm font-bold text-green-700 hover:bg-green-100",
								children: "Dismiss"
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 203,
								columnNumber: 17
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 197,
							columnNumber: 15
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 191,
					columnNumber: 13
				}, this),
				dashTab === "today" && /* @__PURE__ */ _jsxDEV("div", {
					className: "space-y-4",
					children: [/* @__PURE__ */ _jsxDEV("section", { children: [/* @__PURE__ */ _jsxDEV(SectionHeader, {
						icon: /* @__PURE__ */ _jsxDEV(Clock, { size: 13 }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 212,
							columnNumber: 38
						}, this),
						iconBg: "bg-red-100 text-red-700",
						title: "Pending Collections",
						count: pendingToday.length,
						countColor: pendingToday.length > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 212,
						columnNumber: 17
					}, this), pendingToday.length === 0 ? /* @__PURE__ */ _jsxDEV("div", {
						className: "card text-center py-6",
						children: [/* @__PURE__ */ _jsxDEV(CheckCircle2, {
							size: 32,
							className: "mx-auto mb-2 text-green-500"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 215,
							columnNumber: 21
						}, this), /* @__PURE__ */ _jsxDEV("p", {
							className: "font-black text-green-700",
							children: "All collected for today!"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 216,
							columnNumber: 21
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 214,
						columnNumber: 19
					}, this) : /* @__PURE__ */ _jsxDEV("div", {
						className: "space-y-2",
						children: pendingToday.map((b) => /* @__PURE__ */ _jsxDEV(PendingCard, {
							b,
							onCollect: () => quickCollect(b),
							onOpen: () => navigate(`/borrowers/${b.id}`)
						}, b.id, false, {
							fileName: _jsxFileName,
							lineNumber: 221,
							columnNumber: 23
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 219,
						columnNumber: 19
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 211,
						columnNumber: 15
					}, this), /* @__PURE__ */ _jsxDEV("section", { children: [/* @__PURE__ */ _jsxDEV(SectionHeader, {
						icon: /* @__PURE__ */ _jsxDEV(CheckCircle2, { size: 13 }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 228,
							columnNumber: 38
						}, this),
						iconBg: "bg-green-100 text-green-700",
						title: "Paid Today",
						count: paidToday.length,
						countColor: "bg-green-100 text-green-700"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 228,
						columnNumber: 17
					}, this), paidToday.length === 0 ? /* @__PURE__ */ _jsxDEV("div", {
						className: "card text-center py-5 text-slate-400 text-sm",
						children: "No payments collected yet today"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 230,
						columnNumber: 19
					}, this) : /* @__PURE__ */ _jsxDEV("div", {
						className: "space-y-2",
						children: [(allExpanded ? paidToday : paidToday.slice(0, 5)).map((b) => /* @__PURE__ */ _jsxDEV(PaidCard, {
							b,
							todayCols: todayCollMap[b.id] || [],
							onOpen: () => navigate(`/borrowers/${b.id}`)
						}, b.id, false, {
							fileName: _jsxFileName,
							lineNumber: 234,
							columnNumber: 23
						}, this)), paidToday.length > 5 && /* @__PURE__ */ _jsxDEV("button", {
							onClick: () => setAllExpanded((v) => !v),
							className: "flex w-full items-center justify-center gap-1 py-2 text-xs font-bold text-slate-500 hover:text-primary-700",
							children: allExpanded ? /* @__PURE__ */ _jsxDEV(_Fragment, { children: [/* @__PURE__ */ _jsxDEV(ChevronUp, { size: 14 }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 238,
								columnNumber: 42
							}, this), " Show less"] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 238,
								columnNumber: 40
							}, this) : /* @__PURE__ */ _jsxDEV(_Fragment, { children: [
								/* @__PURE__ */ _jsxDEV(ChevronDown, { size: 14 }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 238,
									columnNumber: 83
								}, this),
								" Show ",
								paidToday.length - 5,
								" more"
							] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 238,
								columnNumber: 81
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 237,
							columnNumber: 23
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 232,
						columnNumber: 19
					}, this)] }, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 227,
						columnNumber: 15
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 210,
					columnNumber: 13
				}, this),
				dashTab === "overdue" && /* @__PURE__ */ _jsxDEV("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ _jsxDEV(SectionHeader, {
						icon: /* @__PURE__ */ _jsxDEV(AlertTriangle, { size: 13 }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 250,
							columnNumber: 36
						}, this),
						iconBg: "bg-red-100 text-red-700",
						title: "Repayment Period Over",
						count: overdueBorrowers.length,
						countColor: "bg-red-100 text-red-700"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 250,
						columnNumber: 15
					}, this), overdueBorrowers.length === 0 ? /* @__PURE__ */ _jsxDEV("div", {
						className: "card text-center py-6 text-slate-400 text-sm",
						children: "No overdue borrowers"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 252,
						columnNumber: 17
					}, this) : /* @__PURE__ */ _jsxDEV("div", {
						className: "space-y-2",
						children: overdueBorrowers.map((b) => /* @__PURE__ */ _jsxDEV(OverdueCard, {
							b,
							onOpen: () => navigate(`/borrowers/${b.id}`)
						}, b.id, false, {
							fileName: _jsxFileName,
							lineNumber: 256,
							columnNumber: 21
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 254,
						columnNumber: 17
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 249,
					columnNumber: 13
				}, this),
				dashTab === "excess" && /* @__PURE__ */ _jsxDEV("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ _jsxDEV(SectionHeader, {
						icon: /* @__PURE__ */ _jsxDEV(CheckCircle2, { size: 13 }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 266,
							columnNumber: 36
						}, this),
						iconBg: "bg-green-100 text-green-700",
						title: "Borrowers with Excess Payments",
						count: excessBorrowers.length,
						countColor: "bg-green-100 text-green-700"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 266,
						columnNumber: 15
					}, this), excessBorrowers.length === 0 ? /* @__PURE__ */ _jsxDEV("div", {
						className: "card text-center py-6 text-slate-400 text-sm",
						children: "No borrowers with excess payment"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 268,
						columnNumber: 17
					}, this) : /* @__PURE__ */ _jsxDEV("div", {
						className: "space-y-2",
						children: excessBorrowers.map((b) => /* @__PURE__ */ _jsxDEV(BorrowerCard, {
							b,
							paidToday: paidTodayIds.has(b.id),
							onCollect: () => quickCollect(b),
							onOpen: () => navigate(`/borrowers/${b.id}`)
						}, b.id, false, {
							fileName: _jsxFileName,
							lineNumber: 272,
							columnNumber: 21
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 270,
						columnNumber: 17
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 265,
					columnNumber: 13
				}, this),
				(dashTab === "all" || dashTab === "closed") && /* @__PURE__ */ _jsxDEV("div", {
					className: "space-y-3",
					children: allRows.length ? allRows.map((b) => /* @__PURE__ */ _jsxDEV(BorrowerCard, {
						b,
						paidToday: paidTodayIds.has(b.id),
						onCollect: () => quickCollect(b),
						onOpen: () => navigate(`/borrowers/${b.id}`)
					}, b.id, false, {
						fileName: _jsxFileName,
						lineNumber: 283,
						columnNumber: 17
					}, this)) : /* @__PURE__ */ _jsxDEV(EmptyState, {
						title: dashTab === "all" ? "No active borrowers" : "No closed borrowers",
						message: "Tap + Add to begin."
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 284,
						columnNumber: 20
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 281,
					columnNumber: 13
				}, this)
			] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 188,
				columnNumber: 9
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 144,
		columnNumber: 5
	}, this);
}
_s(Dashboard, "oHABcVssy1tisLDo6pZW76MYcuo=", false, function() {
	return [
		useNavigate,
		useRealtime,
		useRealtime
	];
});
_c = Dashboard;
function SectionHeader({ icon, iconBg, title, count, countColor }) {
	return /* @__PURE__ */ _jsxDEV("div", {
		className: "flex items-center justify-between mb-2 px-0.5",
		children: [/* @__PURE__ */ _jsxDEV("div", {
			className: "flex items-center gap-2",
			children: [/* @__PURE__ */ _jsxDEV("span", {
				className: `flex h-6 w-6 items-center justify-center rounded-full ${iconBg}`,
				children: icon
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 297,
				columnNumber: 9
			}, this), /* @__PURE__ */ _jsxDEV("h2", {
				className: "text-sm font-black text-slate-800",
				children: title
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 298,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 296,
			columnNumber: 7
		}, this), /* @__PURE__ */ _jsxDEV("span", {
			className: `rounded-full px-2.5 py-0.5 text-xs font-black ${countColor}`,
			children: count
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 300,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 295,
		columnNumber: 5
	}, this);
}
_c2 = SectionHeader;
function PendingCard({ b, onCollect, onOpen }) {
	const emi = Number(b.emi || 0);
	const pending = Number(b.pendingAmount || 0);
	const amt = Math.min(emi, pending);
	const isOverdue = borrowerStatus(b) === "Overdue";
	const photo = b.photoUrl || defaultAvatar;
	return /* @__PURE__ */ _jsxDEV("div", {
		className: `card border-l-4 ${isOverdue ? "border-red-500" : "border-amber-400"} cursor-pointer hover:shadow-md transition`,
		onClick: onOpen,
		children: /* @__PURE__ */ _jsxDEV("div", {
			className: "flex items-center gap-3",
			children: [
				/* @__PURE__ */ _jsxDEV("img", {
					src: photo,
					alt: "",
					className: "h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 314,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ _jsxDEV("div", {
					className: "flex-1 min-w-0",
					children: [/* @__PURE__ */ _jsxDEV("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ _jsxDEV("p", {
							className: "font-black text-slate-900 truncate",
							children: b.fullName
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 317,
							columnNumber: 13
						}, this), isOverdue && /* @__PURE__ */ _jsxDEV("span", {
							className: "shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700",
							children: "Overdue"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 318,
							columnNumber: 27
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 316,
						columnNumber: 11
					}, this), /* @__PURE__ */ _jsxDEV("div", {
						className: "flex items-center gap-2 mt-0.5 text-xs text-slate-500",
						children: [/* @__PURE__ */ _jsxDEV("span", { children: ["EMI: ", /* @__PURE__ */ _jsxDEV("b", {
							className: "text-slate-700",
							children: money(emi)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 321,
							columnNumber: 24
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 321,
							columnNumber: 13
						}, this), /* @__PURE__ */ _jsxDEV("span", { children: ["Bal: ", /* @__PURE__ */ _jsxDEV("b", {
							className: "text-red-600",
							children: money(pending)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 322,
							columnNumber: 24
						}, this)] }, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 322,
							columnNumber: 13
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 320,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 315,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ _jsxDEV("div", {
					className: "flex items-center gap-1.5 shrink-0",
					children: [
						/* @__PURE__ */ _jsxDEV("button", {
							onClick: (e) => {
								e.stopPropagation();
								openWhatsApp(b.phone, whatsappReminder(b));
							},
							className: "rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100",
							children: /* @__PURE__ */ _jsxDEV(MessageCircle, { size: 13 }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 327,
								columnNumber: 88
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 326,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ _jsxDEV("a", {
							href: `tel:${b.phone}`,
							onClick: (e) => e.stopPropagation(),
							className: "rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200",
							children: /* @__PURE__ */ _jsxDEV(Phone, { size: 13 }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 329,
								columnNumber: 89
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 328,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ _jsxDEV("button", {
							onClick: (e) => {
								e.stopPropagation();
								onCollect();
							},
							className: "flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-2 text-xs font-black text-white hover:bg-primary-700 active:scale-95 transition-transform",
							children: [
								/* @__PURE__ */ _jsxDEV(Zap, { size: 12 }, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 332,
									columnNumber: 13
								}, this),
								" ",
								money(amt)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 330,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 325,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 313,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 312,
		columnNumber: 5
	}, this);
}
_c3 = PendingCard;
function PaidCard({ b, todayCols, onOpen }) {
	const totalAmt = todayCols.reduce((s, c) => s + Number(c.totalCollected || 0), 0);
	const latestCol = todayCols[0];
	const time = latestCol ? fmtTime(latestCol.paidAt) : "";
	const photo = b.photoUrl || defaultAvatar;
	return /* @__PURE__ */ _jsxDEV("div", {
		className: "card border-l-4 border-green-500 cursor-pointer hover:shadow-md transition",
		onClick: onOpen,
		children: /* @__PURE__ */ _jsxDEV("div", {
			className: "flex items-center gap-3",
			children: [
				/* @__PURE__ */ _jsxDEV("img", {
					src: photo,
					alt: "",
					className: "h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 348,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ _jsxDEV("div", {
					className: "flex-1 min-w-0",
					children: [/* @__PURE__ */ _jsxDEV("p", {
						className: "font-black text-slate-900 truncate",
						children: b.fullName
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 350,
						columnNumber: 11
					}, this), /* @__PURE__ */ _jsxDEV("p", {
						className: "text-xs text-slate-500",
						children: b.phone
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 351,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 349,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ _jsxDEV("div", {
					className: "flex items-center gap-1.5 shrink-0",
					children: [/* @__PURE__ */ _jsxDEV("a", {
						href: `tel:${b.phone}`,
						onClick: (e) => e.stopPropagation(),
						className: "rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200",
						children: /* @__PURE__ */ _jsxDEV(Phone, { size: 13 }, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 355,
							columnNumber: 89
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 354,
						columnNumber: 11
					}, this), /* @__PURE__ */ _jsxDEV("div", {
						className: "text-right shrink-0",
						children: [/* @__PURE__ */ _jsxDEV("p", {
							className: "font-black text-green-700",
							children: money(totalAmt)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 357,
							columnNumber: 13
						}, this), time && /* @__PURE__ */ _jsxDEV("p", {
							className: "text-[11px] text-slate-400",
							children: time
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 358,
							columnNumber: 22
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 356,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 353,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 347,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 346,
		columnNumber: 5
	}, this);
}
_c4 = PaidCard;
function OverdueCard({ b, onOpen }) {
	const pending = Number(b.pendingAmount || 0);
	const paid = Number(b.paidAmount || 0);
	const payable = Number(b.totalPayable ?? b.expectedReturn ?? 0);
	const days = overdueDays(b);
	const photo = b.photoUrl || defaultAvatar;
	return /* @__PURE__ */ _jsxDEV("div", {
		className: "card border-l-4 border-red-500 cursor-pointer hover:shadow-md transition",
		onClick: onOpen,
		children: /* @__PURE__ */ _jsxDEV("div", {
			className: "flex items-center gap-3",
			children: [
				/* @__PURE__ */ _jsxDEV("img", {
					src: photo,
					alt: "",
					className: "h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0"
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 375,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ _jsxDEV("div", {
					className: "flex-1 min-w-0",
					children: [/* @__PURE__ */ _jsxDEV("p", {
						className: "font-black text-slate-900 truncate",
						children: b.fullName
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 377,
						columnNumber: 11
					}, this), /* @__PURE__ */ _jsxDEV("div", {
						className: "grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-500",
						children: [
							/* @__PURE__ */ _jsxDEV("span", { children: ["Payable: ", /* @__PURE__ */ _jsxDEV("b", {
								className: "text-slate-700",
								children: money(payable)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 379,
								columnNumber: 28
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 379,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ _jsxDEV("span", { children: ["Paid: ", /* @__PURE__ */ _jsxDEV("b", {
								className: "text-green-700",
								children: money(paid)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 380,
								columnNumber: 25
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 380,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ _jsxDEV("span", { children: ["Bal: ", /* @__PURE__ */ _jsxDEV("b", {
								className: "text-red-600 font-bold",
								children: money(pending)
							}, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 381,
								columnNumber: 24
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 381,
								columnNumber: 13
							}, this),
							/* @__PURE__ */ _jsxDEV("span", { children: ["Overdue: ", /* @__PURE__ */ _jsxDEV("b", {
								className: "text-red-600",
								children: [days, " days"]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 382,
								columnNumber: 28
							}, this)] }, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 382,
								columnNumber: 13
							}, this),
							b.extensionEmi && /* @__PURE__ */ _jsxDEV("span", {
								className: "col-span-2 text-primary-700 font-semibold",
								children: ["Extended EMI: ", money(b.extensionEmi)]
							}, void 0, true, {
								fileName: _jsxFileName,
								lineNumber: 384,
								columnNumber: 15
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 378,
						columnNumber: 11
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 376,
					columnNumber: 9
				}, this),
				/* @__PURE__ */ _jsxDEV("div", {
					className: "flex items-center gap-1.5 shrink-0",
					children: [
						/* @__PURE__ */ _jsxDEV("button", {
							onClick: (e) => {
								e.stopPropagation();
								openWhatsApp(b.phone, whatsappReminder(b));
							},
							className: "rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100",
							children: /* @__PURE__ */ _jsxDEV(MessageCircle, { size: 13 }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 390,
								columnNumber: 88
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 389,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ _jsxDEV("a", {
							href: `tel:${b.phone}`,
							onClick: (e) => e.stopPropagation(),
							className: "rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200",
							children: /* @__PURE__ */ _jsxDEV(Phone, { size: 13 }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 392,
								columnNumber: 89
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 391,
							columnNumber: 11
						}, this),
						/* @__PURE__ */ _jsxDEV("button", {
							onClick: (e) => {
								e.stopPropagation();
								onOpen();
							},
							className: "rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700",
							children: "Extend"
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 393,
							columnNumber: 11
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 388,
					columnNumber: 9
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 374,
			columnNumber: 7
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 373,
		columnNumber: 5
	}, this);
}
_c5 = OverdueCard;
function BorrowerCard({ b, paidToday, onCollect, onOpen }) {
	const paid = Number(b.paidAmount || 0);
	const pending = Number(b.pendingAmount || 0);
	const emi = Number(b.emi || 0);
	const expected = Number(b.totalPayable ?? b.expectedReturn ?? 0) || 1;
	const progress = Math.min(100, Math.round(paid / expected * 100));
	const status = borrowerStatus(b);
	const photo = b.photoUrl || defaultAvatar;
	const stop = (e) => {
		e.stopPropagation();
		e.preventDefault();
	};
	return /* @__PURE__ */ _jsxDEV("div", {
		role: "button",
		tabIndex: 0,
		onClick: onOpen,
		onKeyDown: (e) => (e.key === "Enter" || e.key === " ") && onOpen(),
		className: "card cursor-pointer space-y-3 transition hover:border-primary-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-200",
		children: [
			/* @__PURE__ */ _jsxDEV("div", {
				className: "flex items-center gap-3",
				children: [
					/* @__PURE__ */ _jsxDEV("img", {
						src: photo,
						alt: "",
						className: "h-11 w-11 rounded-xl object-cover border border-slate-200 shrink-0"
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 415,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ _jsxDEV("div", {
						className: "flex-1 min-w-0",
						children: [/* @__PURE__ */ _jsxDEV("div", {
							className: "flex items-center gap-2 flex-wrap",
							children: [
								/* @__PURE__ */ _jsxDEV("h3", {
									className: "truncate text-base font-black text-slate-900",
									children: b.fullName
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 418,
									columnNumber: 13
								}, this),
								paidToday && /* @__PURE__ */ _jsxDEV("span", {
									className: "rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700",
									children: "Paid"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 419,
									columnNumber: 27
								}, this),
								status === "Overdue" && !paidToday && /* @__PURE__ */ _jsxDEV("span", {
									className: "rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700",
									children: "Overdue"
								}, void 0, false, {
									fileName: _jsxFileName,
									lineNumber: 420,
									columnNumber: 52
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName,
							lineNumber: 417,
							columnNumber: 11
						}, this), /* @__PURE__ */ _jsxDEV("p", {
							className: "text-xs text-slate-500",
							children: b.phone
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 422,
							columnNumber: 11
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 416,
						columnNumber: 9
					}, this),
					/* @__PURE__ */ _jsxDEV("div", {
						className: "flex items-center gap-1.5 shrink-0",
						children: [/* @__PURE__ */ _jsxDEV("button", {
							onClick: (e) => {
								stop(e);
								openWhatsApp(b.phone, whatsappReminder(b));
							},
							className: "rounded-lg bg-green-50 p-1.5 text-green-700 hover:bg-green-100",
							children: /* @__PURE__ */ _jsxDEV(MessageCircle, { size: 12 }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 426,
								columnNumber: 88
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 425,
							columnNumber: 11
						}, this), /* @__PURE__ */ _jsxDEV("a", {
							href: `tel:${b.phone}`,
							onClick: (e) => e.stopPropagation(),
							className: "rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200",
							children: /* @__PURE__ */ _jsxDEV(Phone, { size: 12 }, void 0, false, {
								fileName: _jsxFileName,
								lineNumber: 427,
								columnNumber: 151
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName,
							lineNumber: 427,
							columnNumber: 11
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName,
						lineNumber: 424,
						columnNumber: 9
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 414,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ _jsxDEV("div", { children: [/* @__PURE__ */ _jsxDEV("div", {
				className: "mb-1 flex justify-between text-xs font-semibold text-slate-500",
				children: [/* @__PURE__ */ _jsxDEV("span", { children: "Progress" }, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 431,
					columnNumber: 89
				}, this), /* @__PURE__ */ _jsxDEV("span", { children: [progress, "%"] }, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 431,
					columnNumber: 110
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 431,
				columnNumber: 9
			}, this), /* @__PURE__ */ _jsxDEV("div", {
				className: "h-2 rounded-full bg-slate-100 overflow-hidden",
				children: /* @__PURE__ */ _jsxDEV("div", {
					className: `h-2 rounded-full transition-all ${status === "Completed" ? "bg-green-500" : "bg-primary-600"}`,
					style: { width: `${progress}%` }
				}, void 0, false, {
					fileName: _jsxFileName,
					lineNumber: 433,
					columnNumber: 11
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 432,
				columnNumber: 9
			}, this)] }, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 430,
				columnNumber: 7
			}, this),
			/* @__PURE__ */ _jsxDEV("div", {
				className: "flex items-center justify-between gap-2 text-sm",
				children: [/* @__PURE__ */ _jsxDEV("span", {
					className: "text-slate-600",
					children: ["Paid: ", /* @__PURE__ */ _jsxDEV("b", {
						className: "text-green-700",
						children: money(paid)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 437,
						columnNumber: 48
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 437,
					columnNumber: 9
				}, this), /* @__PURE__ */ _jsxDEV("span", {
					className: "text-slate-600",
					children: ["Balance: ", /* @__PURE__ */ _jsxDEV("b", {
						className: pending > 0 ? "text-red-600" : "text-green-600",
						children: money(pending)
					}, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 438,
						columnNumber: 51
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName,
					lineNumber: 438,
					columnNumber: 9
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 436,
				columnNumber: 7
			}, this),
			emi > 0 && pending > 0 && !paidToday && /* @__PURE__ */ _jsxDEV("button", {
				onClick: (e) => {
					stop(e);
					onCollect();
				},
				className: "flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-black text-white hover:bg-primary-700 active:scale-[0.98] transition-transform",
				children: [
					/* @__PURE__ */ _jsxDEV(Zap, { size: 14 }, void 0, false, {
						fileName: _jsxFileName,
						lineNumber: 443,
						columnNumber: 11
					}, this),
					" Collect ",
					money(Math.min(emi, pending))
				]
			}, void 0, true, {
				fileName: _jsxFileName,
				lineNumber: 441,
				columnNumber: 9
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 411,
		columnNumber: 5
	}, this);
}
_c6 = BorrowerCard;
function SummaryCard({ icon, label, value, color }) {
	return /* @__PURE__ */ _jsxDEV("div", {
		className: `card flex items-center gap-3 p-3 ${color}`,
		children: [/* @__PURE__ */ _jsxDEV("div", {
			className: "shrink-0",
			children: icon
		}, void 0, false, {
			fileName: _jsxFileName,
			lineNumber: 453,
			columnNumber: 7
		}, this), /* @__PURE__ */ _jsxDEV("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ _jsxDEV("p", {
				className: "text-[11px] font-semibold opacity-70 truncate",
				children: label
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 455,
				columnNumber: 9
			}, this), /* @__PURE__ */ _jsxDEV("p", {
				className: "text-base font-black leading-tight",
				children: value
			}, void 0, false, {
				fileName: _jsxFileName,
				lineNumber: 456,
				columnNumber: 9
			}, this)]
		}, void 0, true, {
			fileName: _jsxFileName,
			lineNumber: 454,
			columnNumber: 7
		}, this)]
	}, void 0, true, {
		fileName: _jsxFileName,
		lineNumber: 452,
		columnNumber: 5
	}, this);
}
_c7 = SummaryCard;
var _c, _c2, _c3, _c4, _c5, _c6, _c7;
$RefreshReg$(_c, "Dashboard");
$RefreshReg$(_c2, "SectionHeader");
$RefreshReg$(_c3, "PendingCard");
$RefreshReg$(_c4, "PaidCard");
$RefreshReg$(_c5, "OverdueCard");
$RefreshReg$(_c6, "BorrowerCard");
$RefreshReg$(_c7, "SummaryCard");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
import * as __vite_react_currentExports from "/src/pages/Dashboard.jsx?t=1779800734457";
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }

  const currentExports = __vite_react_currentExports;
  queueMicrotask(() => {
    RefreshRuntime.registerExportsForReactRefresh("D:/SGMI-KK LENDMATE/src/pages/Dashboard.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/SGMI-KK LENDMATE/src/pages/Dashboard.jsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) { return RefreshRuntime.register(type, "D:/SGMI-KK LENDMATE/src/pages/Dashboard.jsx" + ' ' + id); }
function $RefreshSig$() { return RefreshRuntime.createSignatureFunctionForTransform(); }

//# sourceMappingURL=data:application/json;base64,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LEtBQUssQ0FBQztLQUFHLFVBQVU7SUFBRztJQUM5QyxXQUFVO2NBRFo7S0FFRSx3QkFBQyxLQUFELEVBQUssTUFBTSxHQUFLOzs7OztLQUFDO0tBQVUsTUFBTSxLQUFLLElBQUksS0FBSyxPQUFPLENBQUM7SUFDakQ7Ozs7OztFQUVQOzs7Ozs7QUFFVDs7QUFFQSxTQUFTLFlBQVksRUFBRSxNQUFNLE9BQU8sT0FBTyxTQUFTO0NBQ2xELE9BQ0Usd0JBQUMsT0FBRDtFQUFLLFdBQVcsb0NBQW9DO1lBQXBELENBQ0Usd0JBQUMsT0FBRDtHQUFLLFdBQVU7YUFBWTtFQUFVOzs7O1lBQ3JDLHdCQUFDLE9BQUQ7R0FBSyxXQUFVO2FBQWYsQ0FDRSx3QkFBQyxLQUFEO0lBQUcsV0FBVTtjQUFpRDtHQUFTOzs7O2FBQ3ZFLHdCQUFDLEtBQUQ7SUFBRyxXQUFVO2NBQXNDO0dBQVM7Ozs7V0FDekQ7Ozs7O1VBQ0Y7Ozs7OztBQUVUIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIkRhc2hib2FyZC5qc3giXSwidmVyc2lvbiI6Mywic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlTWVtbywgdXNlU3RhdGUsIHVzZUVmZmVjdCB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IExpbmssIHVzZU5hdmlnYXRlIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG5pbXBvcnQgeyBBbGVydFRyaWFuZ2xlLCBDaGVja0NpcmNsZTIsIENoZXZyb25Eb3duLCBDaGV2cm9uVXAsIENsb2NrLCBJbmRpYW5SdXBlZSwgTWVzc2FnZUNpcmNsZSwgUGhvbmUsIFBsdXMsIFNlYXJjaCwgVXNlcnMsIFdhbGxldCwgWmFwIH0gZnJvbSAnbHVjaWRlLXJlYWN0JztcbmltcG9ydCB7IHRvYXN0IH0gZnJvbSAncmVhY3QtdG9hc3RpZnknO1xuaW1wb3J0IHsgYWRkT25lLCBpbmNyZW1lbnQsIHNlcnZlclRpbWVzdGFtcCwgdXBkYXRlT25lIH0gZnJvbSAnLi4vbGliL2RhdGEnO1xuaW1wb3J0IHVzZVJlYWx0aW1lIGZyb20gJy4uL2hvb2tzL3VzZVJlYWx0aW1lJztcbmltcG9ydCBFbXB0eVN0YXRlIGZyb20gJy4uL2NvbXBvbmVudHMvRW1wdHlTdGF0ZSc7XG5pbXBvcnQgeyBib3Jyb3dlclN0YXR1cywgZm10RGF0ZSwgbW9uZXksIG9wZW5XaGF0c0FwcCwgb3ZlcmR1ZURheXMsIHN0ZXBEYXlzLCB0b2RheUlTTywgYWRkRGF5cywgd2hhdHNhcHBSZW1pbmRlciwgd2hhdHNhcHBSZWNlaXB0IH0gZnJvbSAnLi4vbGliL2ZpbmFuY2UnO1xuaW1wb3J0IHsgZGVmYXVsdEF2YXRhciB9IGZyb20gJy4uL2xpYi9waG90b3MnO1xuaW1wb3J0IHsgZ2VuZXJhdGVSZWNlaXB0SFRNTCwgc2hhcmVSZWNlaXB0QXNJbWFnZSB9IGZyb20gJy4uL2xpYi9yZXBvcnRzJztcblxuY29uc3QgaXNEdWVUb2RheSA9IChiLCB0b2RheVN0cikgPT4ge1xuICBpZiAoYm9ycm93ZXJTdGF0dXMoYikgPT09ICdDb21wbGV0ZWQnKSByZXR1cm4gZmFsc2U7XG4gIGlmICghYi5zdGFydERhdGUgfHwgTnVtYmVyKGIucGVuZGluZ0Ftb3VudCB8fCAwKSA8PSAwKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IHN0ZXAgPSBzdGVwRGF5cyhiLmZpbmFuY2VUeXBlIHx8ICdEYWlseScpO1xuICBjb25zdCBkdXJhdGlvbiA9IE51bWJlcihiLmR1cmF0aW9uIHx8IDApO1xuICBjb25zdCBsYXN0RHVlID0gZHVyYXRpb24gPiAwID8gYWRkRGF5cyhiLnN0YXJ0RGF0ZSwgKGR1cmF0aW9uIC0gMSkgKiBzdGVwKSA6IGIuc3RhcnREYXRlO1xuICBpZiAobGFzdER1ZSA8IHRvZGF5U3RyKSByZXR1cm4gdHJ1ZTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkdXJhdGlvbjsgaSsrKSB7XG4gICAgY29uc3QgZCA9IGFkZERheXMoYi5zdGFydERhdGUsIGkgKiBzdGVwKTtcbiAgICBpZiAoZCA9PT0gdG9kYXlTdHIpIHJldHVybiB0cnVlO1xuICAgIGlmIChkID4gdG9kYXlTdHIpIGJyZWFrO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbmNvbnN0IGZtdFRpbWUgPSAodHMpID0+IHtcbiAgY29uc3QgZCA9IHRzPy50b0RhdGUgPyB0cy50b0RhdGUoKSA6IHRzPy5fdCA/IG5ldyBEYXRlKHRzLl90KSA6IG51bGw7XG4gIGlmICghZCkgcmV0dXJuICcnO1xuICByZXR1cm4gZC50b0xvY2FsZVRpbWVTdHJpbmcoJ2VuLUlOJywgeyBob3VyOiAnMi1kaWdpdCcsIG1pbnV0ZTogJzItZGlnaXQnLCBob3VyMTI6IHRydWUgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBEYXNoYm9hcmQoKSB7XG4gIGNvbnN0IG5hdmlnYXRlID0gdXNlTmF2aWdhdGUoKTtcbiAgY29uc3QgW2Rhc2hUYWIsIHNldERhc2hUYWJdID0gdXNlU3RhdGUoJ3RvZGF5Jyk7XG4gIGNvbnN0IFtzZWFyY2gsIHNldFNlYXJjaF0gPSB1c2VTdGF0ZSgnJyk7XG4gIGNvbnN0IFthbGxFeHBhbmRlZCwgc2V0QWxsRXhwYW5kZWRdID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbbGFzdFF1aWNrQ29sbGVjdCwgc2V0TGFzdFF1aWNrQ29sbGVjdF0gPSB1c2VTdGF0ZShudWxsKTtcbiAgY29uc3QgeyBkYXRhOiBib3Jyb3dlcnMsIGxvYWRpbmcgfSA9IHVzZVJlYWx0aW1lKCdib3Jyb3dlcnMnLCB7IG9yZGVyQnk6IFsnY3JlYXRlZEF0JywgJ2Rlc2MnXSB9KTtcbiAgY29uc3QgeyBkYXRhOiByYXdDb2xsZWN0aW9ucywgbG9hZGluZzogY29sbGVjdGlvbnNMb2FkaW5nIH0gPSB1c2VSZWFsdGltZSgnY29sbGVjdGlvbnMnKTtcbiAgY29uc3QgY29sbGVjdGlvbnMgPSB1c2VNZW1vKCgpID0+IHtcbiAgICByZXR1cm4gWy4uLnJhd0NvbGxlY3Rpb25zXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBjb25zdCB0QSA9IGEucGFpZEF0Py5zZWNvbmRzIHx8IDA7XG4gICAgICBjb25zdCB0QiA9IGIucGFpZEF0Py5zZWNvbmRzIHx8IDA7XG4gICAgICByZXR1cm4gdEIgLSB0QTtcbiAgICB9KTtcbiAgfSwgW3Jhd0NvbGxlY3Rpb25zXSk7XG5cbiAgY29uc3QgW3RvZGF5U3RyLCBzZXRUb2RheVN0cl0gPSB1c2VTdGF0ZSh0b2RheUlTTygpKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IHVwZGF0ZURhdGUgPSAoKSA9PiBzZXRUb2RheVN0cih0b2RheUlTTygpKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXMnLCB1cGRhdGVEYXRlKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIHVwZGF0ZURhdGUpO1xuICAgIGNvbnN0IGludGVydmFsID0gc2V0SW50ZXJ2YWwodXBkYXRlRGF0ZSwgNjAwMDApO1xuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignZm9jdXMnLCB1cGRhdGVEYXRlKTtcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgdXBkYXRlRGF0ZSk7XG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICB9O1xuICB9LCBbXSk7XG5cbiAgLy8gU2ltcGxlIHF1aWNrIGNvbGxlY3Qg4oCUIG5vIHNsb3QgYWxsb2NhdGlvbiwganVzdCByZWNvcmRzIGEgcGF5bWVudFxuICBjb25zdCBxdWlja0NvbGxlY3QgPSBhc3luYyAoYikgPT4ge1xuICAgIGNvbnN0IGVtaSA9IE51bWJlcihiLmVtaSB8fCAwKTtcbiAgICBjb25zdCBwZW5kaW5nID0gTnVtYmVyKGIucGVuZGluZ0Ftb3VudCB8fCAwKTtcbiAgICBpZiAoZW1pIDw9IDAgfHwgcGVuZGluZyA8PSAwKSByZXR1cm47XG4gICAgY29uc3QgYW10ID0gTWF0aC5taW4oZW1pLCBwZW5kaW5nKTtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYWRkT25lKCdjb2xsZWN0aW9ucycsIHtcbiAgICAgICAgYm9ycm93ZXJJZDogYi5pZCwgYm9ycm93ZXJOYW1lOiBiLmZ1bGxOYW1lLFxuICAgICAgICB0b3RhbENvbGxlY3RlZDogYW10LCBjb2xsZWN0ZWREYXRlOiB0b2RheVN0cixcbiAgICAgICAgY29sbGVjdG9yTmFtZTogJ0FkbWluJywgbm90ZXM6ICdRdWljayBjb2xsZWN0JyxcbiAgICAgICAgcGFpZEF0OiBzZXJ2ZXJUaW1lc3RhbXAoKSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgbmV3UGVuZGluZyA9IE1hdGgubWF4KDAsIHBlbmRpbmcgLSBhbXQpO1xuICAgICAgYXdhaXQgdXBkYXRlT25lKCdib3Jyb3dlcnMnLCBiLmlkLCB7XG4gICAgICAgIHBhaWRBbW91bnQ6IGluY3JlbWVudChhbXQpLCBwZW5kaW5nQW1vdW50OiBuZXdQZW5kaW5nLFxuICAgICAgICB1cGRhdGVkQXQ6IHNlcnZlclRpbWVzdGFtcCgpLFxuICAgICAgfSk7XG4gICAgICB0b2FzdC5zdWNjZXNzKGBDb2xsZWN0ZWQgJHttb25leShhbXQpfSBmcm9tICR7Yi5mdWxsTmFtZX1gKTtcbiAgICAgIHNldExhc3RRdWlja0NvbGxlY3QoeyBib3Jyb3dlcjogYiwgYW10LCByZW1haW5pbmc6IG5ld1BlbmRpbmcsIGRhdGU6IHRvZGF5U3RyIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHsgdG9hc3QuZXJyb3IoZS5tZXNzYWdlKTsgfVxuICB9O1xuXG4gIC8vIERlcml2ZWQgZGF0YVxuICBjb25zdCBwYWlkVG9kYXlJZHMgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBpZHMgPSBuZXcgU2V0KCk7XG4gICAgY29sbGVjdGlvbnMuZm9yRWFjaCgoYykgPT4ge1xuICAgICAgY29uc3QgZCA9IGMuY29sbGVjdGVkRGF0ZSB8fCBjLnBhaWRBdD8udG9EYXRlPy4oKT8udG9JU09TdHJpbmc/LigpLnNsaWNlKDAsIDEwKTtcbiAgICAgIGlmIChkID09PSB0b2RheVN0cikgaWRzLmFkZChjLmJvcnJvd2VySWQpO1xuICAgIH0pO1xuICAgIHJldHVybiBpZHM7XG4gIH0sIFtjb2xsZWN0aW9ucywgdG9kYXlTdHJdKTtcblxuICBjb25zdCB0b2RheUNvbGxNYXAgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBtID0ge307XG4gICAgY29sbGVjdGlvbnMuZm9yRWFjaCgoYykgPT4ge1xuICAgICAgY29uc3QgZCA9IGMuY29sbGVjdGVkRGF0ZSB8fCBjLnBhaWRBdD8udG9EYXRlPy4oKT8udG9JU09TdHJpbmc/LigpLnNsaWNlKDAsIDEwKTtcbiAgICAgIGlmIChkID09PSB0b2RheVN0cikge1xuICAgICAgICBpZiAoIW1bYy5ib3Jyb3dlcklkXSkgbVtjLmJvcnJvd2VySWRdID0gW107XG4gICAgICAgIG1bYy5ib3Jyb3dlcklkXS5wdXNoKGMpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBtO1xuICB9LCBbY29sbGVjdGlvbnMsIHRvZGF5U3RyXSk7XG5cbiAgY29uc3QgYWN0aXZlQm9ycm93ZXJzID0gdXNlTWVtbygoKSA9PlxuICAgIGJvcnJvd2Vycy5maWx0ZXIoKGIpID0+IGJvcnJvd2VyU3RhdHVzKGIpICE9PSAnQ29tcGxldGVkJyAmJiBib3Jyb3dlclN0YXR1cyhiKSAhPT0gJ092ZXJwYWlkJyksIFtib3Jyb3dlcnNdKTtcblxuICBjb25zdCBleGNlc3NCb3Jyb3dlcnMgPSB1c2VNZW1vKCgpID0+XG4gICAgYm9ycm93ZXJzLmZpbHRlcigoYikgPT4gYm9ycm93ZXJTdGF0dXMoYikgPT09ICdPdmVycGFpZCcpXG4gICAgICAuZmlsdGVyKChiKSA9PiBgJHtiLmZ1bGxOYW1lfSAke2IucGhvbmV9YC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHNlYXJjaC50b0xvd2VyQ2FzZSgpKSksXG4gICAgW2JvcnJvd2Vycywgc2VhcmNoXSk7XG5cbiAgLy8gT3ZlcmR1ZSBib3Jyb3dlcnMgKHJlcGF5bWVudCBwZXJpb2QgZW5kZWQgYnV0IHN0aWxsIHBlbmRpbmcpXG4gIGNvbnN0IG92ZXJkdWVCb3Jyb3dlcnMgPSB1c2VNZW1vKCgpID0+XG4gICAgYm9ycm93ZXJzLmZpbHRlcigoYikgPT4gYm9ycm93ZXJTdGF0dXMoYikgPT09ICdPdmVyZHVlJylcbiAgICAgIC5maWx0ZXIoKGIpID0+IGAke2IuZnVsbE5hbWV9ICR7Yi5waG9uZX1gLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoc2VhcmNoLnRvTG93ZXJDYXNlKCkpKSxcbiAgICBbYm9ycm93ZXJzLCBzZWFyY2hdKTtcblxuICBjb25zdCBwZW5kaW5nVG9kYXkgPSB1c2VNZW1vKCgpID0+XG4gICAgYWN0aXZlQm9ycm93ZXJzLmZpbHRlcigoYikgPT4gaXNEdWVUb2RheShiLCB0b2RheVN0cikgJiYgIXBhaWRUb2RheUlkcy5oYXMoYi5pZCkpXG4gICAgICAuZmlsdGVyKChiKSA9PiBgJHtiLmZ1bGxOYW1lfSAke2IucGhvbmV9YC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHNlYXJjaC50b0xvd2VyQ2FzZSgpKSksXG4gICAgW2FjdGl2ZUJvcnJvd2VycywgcGFpZFRvZGF5SWRzLCB0b2RheVN0ciwgc2VhcmNoXSk7XG5cbiAgY29uc3QgcGFpZFRvZGF5ID0gdXNlTWVtbygoKSA9PlxuICAgIGFjdGl2ZUJvcnJvd2Vycy5maWx0ZXIoKGIpID0+IHBhaWRUb2RheUlkcy5oYXMoYi5pZCkpXG4gICAgICAuZmlsdGVyKChiKSA9PiBgJHtiLmZ1bGxOYW1lfSAke2IucGhvbmV9YC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHNlYXJjaC50b0xvd2VyQ2FzZSgpKSksXG4gICAgW2FjdGl2ZUJvcnJvd2VycywgcGFpZFRvZGF5SWRzLCBzZWFyY2hdKTtcblxuICBjb25zdCBhbGxSb3dzID0gdXNlTWVtbygoKSA9PiBib3Jyb3dlcnNcbiAgICAuZmlsdGVyKChiKSA9PiBkYXNoVGFiID09PSAnYWxsJyA/IGJvcnJvd2VyU3RhdHVzKGIpICE9PSAnQ29tcGxldGVkJyA6IGJvcnJvd2VyU3RhdHVzKGIpID09PSAnQ29tcGxldGVkJylcbiAgICAuZmlsdGVyKChiKSA9PiBgJHtiLmZ1bGxOYW1lfSAke2IucGhvbmV9YC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHNlYXJjaC50b0xvd2VyQ2FzZSgpKSksXG4gICAgW2JvcnJvd2VycywgZGFzaFRhYiwgc2VhcmNoXSk7XG5cbiAgY29uc3QgY29sbGVjdGVkVG9kYXkgPSBjb2xsZWN0aW9uc1xuICAgIC5maWx0ZXIoKGMpID0+IChjLmNvbGxlY3RlZERhdGUgfHwgYy5wYWlkQXQ/LnRvRGF0ZT8uKCk/LnRvSVNPU3RyaW5nPy4oKS5zbGljZSgwLCAxMCkpID09PSB0b2RheVN0cilcbiAgICAucmVkdWNlKChzLCBjKSA9PiBzICsgTnVtYmVyKGMudG90YWxDb2xsZWN0ZWQgfHwgMCksIDApO1xuICBjb25zdCBhY3RpdmVDb3VudCA9IGFjdGl2ZUJvcnJvd2Vycy5sZW5ndGg7XG4gIGNvbnN0IHRvdGFsUGVuZGluZyA9IGJvcnJvd2Vycy5yZWR1Y2UoKHMsIGIpID0+IHMgKyBOdW1iZXIoYi5wZW5kaW5nQW1vdW50IHx8IDApLCAwKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XG4gICAgICB7LyogU3VtbWFyeSBzdHJpcCAqL31cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMiBnYXAtMiBzbTpncmlkLWNvbHMtNFwiPlxuICAgICAgICA8U3VtbWFyeUNhcmQgaWNvbj17PFVzZXJzIHNpemU9ezE2fSAvPn0gbGFiZWw9XCJBY3RpdmVcIiB2YWx1ZT17YWN0aXZlQ291bnR9IGNvbG9yPVwiYmctcHJpbWFyeS01MCB0ZXh0LXByaW1hcnktNzAwXCIgLz5cbiAgICAgICAgPFN1bW1hcnlDYXJkIGljb249ezxJbmRpYW5SdXBlZSBzaXplPXsxNn0gLz59IGxhYmVsPVwiVG90YWwgUGVuZGluZ1wiIHZhbHVlPXttb25leSh0b3RhbFBlbmRpbmcpfSBjb2xvcj1cImJnLXJlZC01MCB0ZXh0LXJlZC03MDBcIiAvPlxuICAgICAgICA8U3VtbWFyeUNhcmQgaWNvbj17PFdhbGxldCBzaXplPXsxNn0gLz59IGxhYmVsPVwiQ29sbGVjdGVkIFRvZGF5XCIgdmFsdWU9e21vbmV5KGNvbGxlY3RlZFRvZGF5KX0gY29sb3I9XCJiZy1ncmVlbi01MCB0ZXh0LWdyZWVuLTcwMFwiIC8+XG4gICAgICAgIDxTdW1tYXJ5Q2FyZCBpY29uPXs8Q2xvY2sgc2l6ZT17MTZ9IC8+fSBsYWJlbD1cIlBlbmRpbmcgVG9kYXlcIiB2YWx1ZT17cGVuZGluZ1RvZGF5Lmxlbmd0aH0gY29sb3I9e3BlbmRpbmdUb2RheS5sZW5ndGggPiAwID8gJ2JnLWFtYmVyLTUwIHRleHQtYW1iZXItNzAwJyA6ICdiZy1ncmVlbi01MCB0ZXh0LWdyZWVuLTcwMCd9IC8+XG4gICAgICA8L2Rpdj5cblxuICAgICAgey8qIFByb2dyZXNzIGJhciAqL31cbiAgICAgIHsocGVuZGluZ1RvZGF5Lmxlbmd0aCArIHBhaWRUb2RheS5sZW5ndGgpID4gMCAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY2FyZCAhcHktM1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIHRleHQteHMgZm9udC1ib2xkIHRleHQtc2xhdGUtNjAwIG1iLTJcIj5cbiAgICAgICAgICAgIDxzcGFuPlRvZGF5J3MgUHJvZ3Jlc3M8L3NwYW4+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LWdyZWVuLTcwMFwiPntwYWlkVG9kYXkubGVuZ3RofSAvIHtwZW5kaW5nVG9kYXkubGVuZ3RoICsgcGFpZFRvZGF5Lmxlbmd0aH0gY29sbGVjdGVkPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaC0yLjUgdy1mdWxsIHJvdW5kZWQtZnVsbCBiZy1zbGF0ZS0xMDAgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImgtMi41IHJvdW5kZWQtZnVsbCBiZy1ncmVlbi01MDAgdHJhbnNpdGlvbi1hbGxcIlxuICAgICAgICAgICAgICBzdHlsZT17eyB3aWR0aDogYCR7TWF0aC5yb3VuZCgocGFpZFRvZGF5Lmxlbmd0aCAvIE1hdGgubWF4KDEsIHBlbmRpbmdUb2RheS5sZW5ndGggKyBwYWlkVG9kYXkubGVuZ3RoKSkgKiAxMDApfSVgIH19IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cblxuICAgICAgey8qIFNlYXJjaCArIFRhYnMgKi99XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNhcmQgc3BhY2UteS0zXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLXNsYXRlLTIwMCBweC0zXCI+XG4gICAgICAgICAgPFNlYXJjaCBzaXplPXsxNX0gY2xhc3NOYW1lPVwic2hyaW5rLTAgdGV4dC1zbGF0ZS00MDBcIiAvPlxuICAgICAgICAgIDxpbnB1dCBjbGFzc05hbWU9XCJ3LWZ1bGwgYmctdHJhbnNwYXJlbnQgcHktMi41IHRleHQtc20gb3V0bGluZS1ub25lXCIgcGxhY2Vob2xkZXI9XCJTZWFyY2ggYnkgbmFtZSBvciBwaG9uZS4uLlwiIHZhbHVlPXtzZWFyY2h9IG9uQ2hhbmdlPXsoZSkgPT4gc2V0U2VhcmNoKGUudGFyZ2V0LnZhbHVlKX0gLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgZmxleC13cmFwXCI+XG4gICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiBzZXREYXNoVGFiKCd0b2RheScpfSBjbGFzc05hbWU9e2Rhc2hUYWIgPT09ICd0b2RheScgPyAnYnRuLXByaW1hcnknIDogJ2J0bi1zb2Z0J30+VG9kYXk8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpID0+IHNldERhc2hUYWIoJ292ZXJkdWUnKX0gY2xhc3NOYW1lPXtkYXNoVGFiID09PSAnb3ZlcmR1ZScgPyAnYnRuLXByaW1hcnknIDogJ2J0bi1zb2Z0J30+XG4gICAgICAgICAgICBPdmVyZHVlIHtvdmVyZHVlQm9ycm93ZXJzLmxlbmd0aCA+IDAgJiYgPHNwYW4gY2xhc3NOYW1lPVwibWwtMSByb3VuZGVkLWZ1bGwgYmctcmVkLTEwMCBweC0xLjUgdGV4dC1bMTBweF0gZm9udC1ibGFjayB0ZXh0LXJlZC03MDBcIj57b3ZlcmR1ZUJvcnJvd2Vycy5sZW5ndGh9PC9zcGFuPn1cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpID0+IHNldERhc2hUYWIoJ2V4Y2VzcycpfSBjbGFzc05hbWU9e2Rhc2hUYWIgPT09ICdleGNlc3MnID8gJ2J0bi1wcmltYXJ5JyA6ICdidG4tc29mdCd9PlxuICAgICAgICAgICAgRXhjZXNzIFBhaWQge2V4Y2Vzc0JvcnJvd2Vycy5sZW5ndGggPiAwICYmIDxzcGFuIGNsYXNzTmFtZT1cIm1sLTEgcm91bmRlZC1mdWxsIGJnLWdyZWVuLTEwMCBweC0xLjUgdGV4dC1bMTBweF0gZm9udC1ibGFjayB0ZXh0LWdyZWVuLTcwMFwiPntleGNlc3NCb3Jyb3dlcnMubGVuZ3RofTwvc3Bhbj59XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiBzZXREYXNoVGFiKCdhbGwnKX0gY2xhc3NOYW1lPXtkYXNoVGFiID09PSAnYWxsJyA/ICdidG4tcHJpbWFyeScgOiAnYnRuLXNvZnQnfT5BbGwgQWN0aXZlPC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiBzZXREYXNoVGFiKCdjbG9zZWQnKX0gY2xhc3NOYW1lPXtkYXNoVGFiID09PSAnY2xvc2VkJyA/ICdidG4tcHJpbWFyeScgOiAnYnRuLXNvZnQnfT5DbG9zZWQ8L2J1dHRvbj5cbiAgICAgICAgICA8TGluayB0bz1cIi9ib3Jyb3dlcnMvbmV3XCIgY2xhc3NOYW1lPVwiYnRuLXByaW1hcnkgbWwtYXV0b1wiPjxQbHVzIHNpemU9ezE1fSAvPiBBZGQ8L0xpbms+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIHtsb2FkaW5nID8gPGRpdiBjbGFzc05hbWU9XCJza2VsZXRvbiBoLTMyXCIgLz4gOiAoXG4gICAgICAgIDw+XG4gICAgICAgICAgey8qIFF1aWNrIENvbGxlY3QgUmVjZWlwdCBCYW5uZXIgKi99XG4gICAgICAgICAge2xhc3RRdWlja0NvbGxlY3QgJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjYXJkIGJvcmRlci0yIGJvcmRlci1ncmVlbi0yMDAgYmctZ3JlZW4tNTAgc3BhY2UteS0yXCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuXCI+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LWJsYWNrIHRleHQtZ3JlZW4tODAwXCI+4pyTIENvbGxlY3RlZCBmcm9tIHtsYXN0UXVpY2tDb2xsZWN0LmJvcnJvd2VyLmZ1bGxOYW1lfTwvcD5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpID0+IHNldExhc3RRdWlja0NvbGxlY3QobnVsbCl9IGNsYXNzTmFtZT1cInRleHQtZ3JlZW4tNjAwXCI+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1sZyBsZWFkaW5nLW5vbmVcIj7Dlzwvc3Bhbj48L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ncmVlbi03MDBcIj57bW9uZXkobGFzdFF1aWNrQ29sbGVjdC5hbXQpfSDigKIgQmFsYW5jZToge21vbmV5KGxhc3RRdWlja0NvbGxlY3QucmVtYWluaW5nKX0g4oCiIHtsYXN0UXVpY2tDb2xsZWN0LmJvcnJvd2VyLnBob25lfTwvcD5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0yIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4geyBjb25zdCBodG1sID0gZ2VuZXJhdGVSZWNlaXB0SFRNTCh7IGJvcnJvd2VyOiBsYXN0UXVpY2tDb2xsZWN0LmJvcnJvd2VyLCBhbW91bnQ6IGxhc3RRdWlja0NvbGxlY3QuYW10LCBkYXRlOiBmbXREYXRlKGxhc3RRdWlja0NvbGxlY3QuZGF0ZSksIHJlbWFpbmluZzogbGFzdFF1aWNrQ29sbGVjdC5yZW1haW5pbmcsIGNvbGxlY3Rvck5hbWU6ICdBZG1pbicgfSk7IHNoYXJlUmVjZWlwdEFzSW1hZ2UoaHRtbCwgbGFzdFF1aWNrQ29sbGVjdC5ib3Jyb3dlci5waG9uZSwgd2hhdHNhcHBSZWNlaXB0KHsgLi4ubGFzdFF1aWNrQ29sbGVjdC5ib3Jyb3dlciwgcGVuZGluZ0Ftb3VudDogbGFzdFF1aWNrQ29sbGVjdC5yZW1haW5pbmcgfSwgbGFzdFF1aWNrQ29sbGVjdC5hbXQsIGxhc3RRdWlja0NvbGxlY3QuZGF0ZSkpOyB9fVxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgZ2FwLTEuNSByb3VuZGVkLXhsIGJnLWdyZWVuLTYwMCBweS0yIHRleHQtc20gZm9udC1ibGFjayB0ZXh0LXdoaXRlIGhvdmVyOmJnLWdyZWVuLTcwMFwiPlxuICAgICAgICAgICAgICAgICAgPE1lc3NhZ2VDaXJjbGUgc2l6ZT17MTR9IC8+IFdoYXRzQXBwIFJlY2VpcHRcbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpID0+IHNldExhc3RRdWlja0NvbGxlY3QobnVsbCl9IGNsYXNzTmFtZT1cInJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci1ncmVlbi0yMDAgcHktMiB0ZXh0LXNtIGZvbnQtYm9sZCB0ZXh0LWdyZWVuLTcwMCBob3ZlcjpiZy1ncmVlbi0xMDBcIj5EaXNtaXNzPC9idXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHsvKiBUT0RBWSBUQUIgKi99XG4gICAgICAgICAge2Rhc2hUYWIgPT09ICd0b2RheScgJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgPHNlY3Rpb24+XG4gICAgICAgICAgICAgICAgPFNlY3Rpb25IZWFkZXIgaWNvbj17PENsb2NrIHNpemU9ezEzfSAvPn0gaWNvbkJnPVwiYmctcmVkLTEwMCB0ZXh0LXJlZC03MDBcIiB0aXRsZT1cIlBlbmRpbmcgQ29sbGVjdGlvbnNcIiBjb3VudD17cGVuZGluZ1RvZGF5Lmxlbmd0aH0gY291bnRDb2xvcj17cGVuZGluZ1RvZGF5Lmxlbmd0aCA+IDAgPyAnYmctcmVkLTEwMCB0ZXh0LXJlZC03MDAnIDogJ2JnLWdyZWVuLTEwMCB0ZXh0LWdyZWVuLTcwMCd9IC8+XG4gICAgICAgICAgICAgICAge3BlbmRpbmdUb2RheS5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNhcmQgdGV4dC1jZW50ZXIgcHktNlwiPlxuICAgICAgICAgICAgICAgICAgICA8Q2hlY2tDaXJjbGUyIHNpemU9ezMyfSBjbGFzc05hbWU9XCJteC1hdXRvIG1iLTIgdGV4dC1ncmVlbi01MDBcIiAvPlxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJmb250LWJsYWNrIHRleHQtZ3JlZW4tNzAwXCI+QWxsIGNvbGxlY3RlZCBmb3IgdG9kYXkhPC9wPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XG4gICAgICAgICAgICAgICAgICAgIHtwZW5kaW5nVG9kYXkubWFwKChiKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgPFBlbmRpbmdDYXJkIGtleT17Yi5pZH0gYj17Yn0gb25Db2xsZWN0PXsoKSA9PiBxdWlja0NvbGxlY3QoYil9IG9uT3Blbj17KCkgPT4gbmF2aWdhdGUoYC9ib3Jyb3dlcnMvJHtiLmlkfWApfSAvPlxuICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvc2VjdGlvbj5cblxuICAgICAgICAgICAgICA8c2VjdGlvbj5cbiAgICAgICAgICAgICAgICA8U2VjdGlvbkhlYWRlciBpY29uPXs8Q2hlY2tDaXJjbGUyIHNpemU9ezEzfSAvPn0gaWNvbkJnPVwiYmctZ3JlZW4tMTAwIHRleHQtZ3JlZW4tNzAwXCIgdGl0bGU9XCJQYWlkIFRvZGF5XCIgY291bnQ9e3BhaWRUb2RheS5sZW5ndGh9IGNvdW50Q29sb3I9XCJiZy1ncmVlbi0xMDAgdGV4dC1ncmVlbi03MDBcIiAvPlxuICAgICAgICAgICAgICAgIHtwYWlkVG9kYXkubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjYXJkIHRleHQtY2VudGVyIHB5LTUgdGV4dC1zbGF0ZS00MDAgdGV4dC1zbVwiPk5vIHBheW1lbnRzIGNvbGxlY3RlZCB5ZXQgdG9kYXk8L2Rpdj5cbiAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTJcIj5cbiAgICAgICAgICAgICAgICAgICAgeyhhbGxFeHBhbmRlZCA/IHBhaWRUb2RheSA6IHBhaWRUb2RheS5zbGljZSgwLCA1KSkubWFwKChiKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgPFBhaWRDYXJkIGtleT17Yi5pZH0gYj17Yn0gdG9kYXlDb2xzPXt0b2RheUNvbGxNYXBbYi5pZF0gfHwgW119IG9uT3Blbj17KCkgPT4gbmF2aWdhdGUoYC9ib3Jyb3dlcnMvJHtiLmlkfWApfSAvPlxuICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAge3BhaWRUb2RheS5sZW5ndGggPiA1ICYmIChcbiAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpID0+IHNldEFsbEV4cGFuZGVkKCh2KSA9PiAhdil9IGNsYXNzTmFtZT1cImZsZXggdy1mdWxsIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBnYXAtMSBweS0yIHRleHQteHMgZm9udC1ib2xkIHRleHQtc2xhdGUtNTAwIGhvdmVyOnRleHQtcHJpbWFyeS03MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHthbGxFeHBhbmRlZCA/IDw+PENoZXZyb25VcCBzaXplPXsxNH0gLz4gU2hvdyBsZXNzPC8+IDogPD48Q2hldnJvbkRvd24gc2l6ZT17MTR9IC8+IFNob3cge3BhaWRUb2RheS5sZW5ndGggLSA1fSBtb3JlPC8+fVxuICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPC9zZWN0aW9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHsvKiBPVkVSRFVFIFRBQiAqL31cbiAgICAgICAgICB7ZGFzaFRhYiA9PT0gJ292ZXJkdWUnICYmIChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0zXCI+XG4gICAgICAgICAgICAgIDxTZWN0aW9uSGVhZGVyIGljb249ezxBbGVydFRyaWFuZ2xlIHNpemU9ezEzfSAvPn0gaWNvbkJnPVwiYmctcmVkLTEwMCB0ZXh0LXJlZC03MDBcIiB0aXRsZT1cIlJlcGF5bWVudCBQZXJpb2QgT3ZlclwiIGNvdW50PXtvdmVyZHVlQm9ycm93ZXJzLmxlbmd0aH0gY291bnRDb2xvcj1cImJnLXJlZC0xMDAgdGV4dC1yZWQtNzAwXCIgLz5cbiAgICAgICAgICAgICAge292ZXJkdWVCb3Jyb3dlcnMubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY2FyZCB0ZXh0LWNlbnRlciBweS02IHRleHQtc2xhdGUtNDAwIHRleHQtc21cIj5ObyBvdmVyZHVlIGJvcnJvd2VyczwvZGl2PlxuICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XG4gICAgICAgICAgICAgICAgICB7b3ZlcmR1ZUJvcnJvd2Vycy5tYXAoKGIpID0+IChcbiAgICAgICAgICAgICAgICAgICAgPE92ZXJkdWVDYXJkIGtleT17Yi5pZH0gYj17Yn0gb25PcGVuPXsoKSA9PiBuYXZpZ2F0ZShgL2JvcnJvd2Vycy8ke2IuaWR9YCl9IC8+XG4gICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG5cbiAgICAgICAgICB7LyogRVhDRVNTIFBBSUQgVEFCICovfVxuICAgICAgICAgIHtkYXNoVGFiID09PSAnZXhjZXNzJyAmJiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktM1wiPlxuICAgICAgICAgICAgICA8U2VjdGlvbkhlYWRlciBpY29uPXs8Q2hlY2tDaXJjbGUyIHNpemU9ezEzfSAvPn0gaWNvbkJnPVwiYmctZ3JlZW4tMTAwIHRleHQtZ3JlZW4tNzAwXCIgdGl0bGU9XCJCb3Jyb3dlcnMgd2l0aCBFeGNlc3MgUGF5bWVudHNcIiBjb3VudD17ZXhjZXNzQm9ycm93ZXJzLmxlbmd0aH0gY291bnRDb2xvcj1cImJnLWdyZWVuLTEwMCB0ZXh0LWdyZWVuLTcwMFwiIC8+XG4gICAgICAgICAgICAgIHtleGNlc3NCb3Jyb3dlcnMubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY2FyZCB0ZXh0LWNlbnRlciBweS02IHRleHQtc2xhdGUtNDAwIHRleHQtc21cIj5ObyBib3Jyb3dlcnMgd2l0aCBleGNlc3MgcGF5bWVudDwvZGl2PlxuICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XG4gICAgICAgICAgICAgICAgICB7ZXhjZXNzQm9ycm93ZXJzLm1hcCgoYikgPT4gKFxuICAgICAgICAgICAgICAgICAgICA8Qm9ycm93ZXJDYXJkIGtleT17Yi5pZH0gYj17Yn0gcGFpZFRvZGF5PXtwYWlkVG9kYXlJZHMuaGFzKGIuaWQpfSBvbkNvbGxlY3Q9eygpID0+IHF1aWNrQ29sbGVjdChiKX0gb25PcGVuPXsoKSA9PiBuYXZpZ2F0ZShgL2JvcnJvd2Vycy8ke2IuaWR9YCl9IC8+XG4gICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG5cbiAgICAgICAgICB7LyogQUxMIEFDVElWRSAvIENMT1NFRCAqL31cbiAgICAgICAgICB7KGRhc2hUYWIgPT09ICdhbGwnIHx8IGRhc2hUYWIgPT09ICdjbG9zZWQnKSAmJiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktM1wiPlxuICAgICAgICAgICAgICB7YWxsUm93cy5sZW5ndGggPyBhbGxSb3dzLm1hcCgoYikgPT4gKFxuICAgICAgICAgICAgICAgIDxCb3Jyb3dlckNhcmQga2V5PXtiLmlkfSBiPXtifSBwYWlkVG9kYXk9e3BhaWRUb2RheUlkcy5oYXMoYi5pZCl9IG9uQ29sbGVjdD17KCkgPT4gcXVpY2tDb2xsZWN0KGIpfSBvbk9wZW49eygpID0+IG5hdmlnYXRlKGAvYm9ycm93ZXJzLyR7Yi5pZH1gKX0gLz5cbiAgICAgICAgICAgICAgKSkgOiA8RW1wdHlTdGF0ZSB0aXRsZT17ZGFzaFRhYiA9PT0gJ2FsbCcgPyAnTm8gYWN0aXZlIGJvcnJvd2VycycgOiAnTm8gY2xvc2VkIGJvcnJvd2Vycyd9IG1lc3NhZ2U9XCJUYXAgKyBBZGQgdG8gYmVnaW4uXCIgLz59XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8Lz5cbiAgICAgICl9XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmZ1bmN0aW9uIFNlY3Rpb25IZWFkZXIoeyBpY29uLCBpY29uQmcsIHRpdGxlLCBjb3VudCwgY291bnRDb2xvciB9KSB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gbWItMiBweC0wLjVcIj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgPHNwYW4gY2xhc3NOYW1lPXtgZmxleCBoLTYgdy02IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLWZ1bGwgJHtpY29uQmd9YH0+e2ljb259PC9zcGFuPlxuICAgICAgICA8aDIgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LWJsYWNrIHRleHQtc2xhdGUtODAwXCI+e3RpdGxlfTwvaDI+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxzcGFuIGNsYXNzTmFtZT17YHJvdW5kZWQtZnVsbCBweC0yLjUgcHktMC41IHRleHQteHMgZm9udC1ibGFjayAke2NvdW50Q29sb3J9YH0+e2NvdW50fTwvc3Bhbj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuZnVuY3Rpb24gUGVuZGluZ0NhcmQoeyBiLCBvbkNvbGxlY3QsIG9uT3BlbiB9KSB7XG4gIGNvbnN0IGVtaSA9IE51bWJlcihiLmVtaSB8fCAwKTtcbiAgY29uc3QgcGVuZGluZyA9IE51bWJlcihiLnBlbmRpbmdBbW91bnQgfHwgMCk7XG4gIGNvbnN0IGFtdCA9IE1hdGgubWluKGVtaSwgcGVuZGluZyk7XG4gIGNvbnN0IGlzT3ZlcmR1ZSA9IGJvcnJvd2VyU3RhdHVzKGIpID09PSAnT3ZlcmR1ZSc7XG4gIGNvbnN0IHBob3RvID0gYi5waG90b1VybCB8fCBkZWZhdWx0QXZhdGFyO1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPXtgY2FyZCBib3JkZXItbC00ICR7aXNPdmVyZHVlID8gJ2JvcmRlci1yZWQtNTAwJyA6ICdib3JkZXItYW1iZXItNDAwJ30gY3Vyc29yLXBvaW50ZXIgaG92ZXI6c2hhZG93LW1kIHRyYW5zaXRpb25gfSBvbkNsaWNrPXtvbk9wZW59PlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtM1wiPlxuICAgICAgICA8aW1nIHNyYz17cGhvdG99IGFsdD1cIlwiIGNsYXNzTmFtZT1cImgtMTAgdy0xMCByb3VuZGVkLXhsIG9iamVjdC1jb3ZlciBib3JkZXIgYm9yZGVyLXNsYXRlLTIwMCBzaHJpbmstMFwiIC8+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIG1pbi13LTBcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJmb250LWJsYWNrIHRleHQtc2xhdGUtOTAwIHRydW5jYXRlXCI+e2IuZnVsbE5hbWV9PC9wPlxuICAgICAgICAgICAge2lzT3ZlcmR1ZSAmJiA8c3BhbiBjbGFzc05hbWU9XCJzaHJpbmstMCByb3VuZGVkLWZ1bGwgYmctcmVkLTEwMCBweC0yIHB5LTAuNSB0ZXh0LVsxMHB4XSBmb250LWJsYWNrIHRleHQtcmVkLTcwMFwiPk92ZXJkdWU8L3NwYW4+fVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgbXQtMC41IHRleHQteHMgdGV4dC1zbGF0ZS01MDBcIj5cbiAgICAgICAgICAgIDxzcGFuPkVNSTogPGIgY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS03MDBcIj57bW9uZXkoZW1pKX08L2I+PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4+QmFsOiA8YiBjbGFzc05hbWU9XCJ0ZXh0LXJlZC02MDBcIj57bW9uZXkocGVuZGluZyl9PC9iPjwvc3Bhbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEuNSBzaHJpbmstMFwiPlxuICAgICAgICAgIDxidXR0b24gb25DbGljaz17KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgb3BlbldoYXRzQXBwKGIucGhvbmUsIHdoYXRzYXBwUmVtaW5kZXIoYikpOyB9fVxuICAgICAgICAgICAgY2xhc3NOYW1lPVwicm91bmRlZC1sZyBiZy1ncmVlbi01MCBwLTEuNSB0ZXh0LWdyZWVuLTcwMCBob3ZlcjpiZy1ncmVlbi0xMDBcIj48TWVzc2FnZUNpcmNsZSBzaXplPXsxM30gLz48L2J1dHRvbj5cbiAgICAgICAgICA8YSBocmVmPXtgdGVsOiR7Yi5waG9uZX1gfSBvbkNsaWNrPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInJvdW5kZWQtbGcgYmctc2xhdGUtMTAwIHAtMS41IHRleHQtc2xhdGUtNjAwIGhvdmVyOmJnLXNsYXRlLTIwMFwiPjxQaG9uZSBzaXplPXsxM30gLz48L2E+XG4gICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBvbkNvbGxlY3QoKTsgfX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0xIHJvdW5kZWQteGwgYmctcHJpbWFyeS02MDAgcHgtMyBweS0yIHRleHQteHMgZm9udC1ibGFjayB0ZXh0LXdoaXRlIGhvdmVyOmJnLXByaW1hcnktNzAwIGFjdGl2ZTpzY2FsZS05NSB0cmFuc2l0aW9uLXRyYW5zZm9ybVwiPlxuICAgICAgICAgICAgPFphcCBzaXplPXsxMn0gLz4ge21vbmV5KGFtdCl9XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmZ1bmN0aW9uIFBhaWRDYXJkKHsgYiwgdG9kYXlDb2xzLCBvbk9wZW4gfSkge1xuICBjb25zdCB0b3RhbEFtdCA9IHRvZGF5Q29scy5yZWR1Y2UoKHMsIGMpID0+IHMgKyBOdW1iZXIoYy50b3RhbENvbGxlY3RlZCB8fCAwKSwgMCk7XG4gIGNvbnN0IGxhdGVzdENvbCA9IHRvZGF5Q29sc1swXTtcbiAgY29uc3QgdGltZSA9IGxhdGVzdENvbCA/IGZtdFRpbWUobGF0ZXN0Q29sLnBhaWRBdCkgOiAnJztcbiAgY29uc3QgcGhvdG8gPSBiLnBob3RvVXJsIHx8IGRlZmF1bHRBdmF0YXI7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJjYXJkIGJvcmRlci1sLTQgYm9yZGVyLWdyZWVuLTUwMCBjdXJzb3ItcG9pbnRlciBob3ZlcjpzaGFkb3ctbWQgdHJhbnNpdGlvblwiIG9uQ2xpY2s9e29uT3Blbn0+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgIDxpbWcgc3JjPXtwaG90b30gYWx0PVwiXCIgY2xhc3NOYW1lPVwiaC0xMCB3LTEwIHJvdW5kZWQteGwgb2JqZWN0LWNvdmVyIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIHNocmluay0wXCIgLz5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgbWluLXctMFwiPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cImZvbnQtYmxhY2sgdGV4dC1zbGF0ZS05MDAgdHJ1bmNhdGVcIj57Yi5mdWxsTmFtZX08L3A+XG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTUwMFwiPntiLnBob25lfTwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEuNSBzaHJpbmstMFwiPlxuICAgICAgICAgIDxhIGhyZWY9e2B0ZWw6JHtiLnBob25lfWB9IG9uQ2xpY2s9eyhlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpfVxuICAgICAgICAgICAgY2xhc3NOYW1lPVwicm91bmRlZC1sZyBiZy1zbGF0ZS0xMDAgcC0xLjUgdGV4dC1zbGF0ZS02MDAgaG92ZXI6Ymctc2xhdGUtMjAwXCI+PFBob25lIHNpemU9ezEzfSAvPjwvYT5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtcmlnaHQgc2hyaW5rLTBcIj5cbiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cImZvbnQtYmxhY2sgdGV4dC1ncmVlbi03MDBcIj57bW9uZXkodG90YWxBbXQpfTwvcD5cbiAgICAgICAgICAgIHt0aW1lICYmIDxwIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIHRleHQtc2xhdGUtNDAwXCI+e3RpbWV9PC9wPn1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuZnVuY3Rpb24gT3ZlcmR1ZUNhcmQoeyBiLCBvbk9wZW4gfSkge1xuICBjb25zdCBwZW5kaW5nID0gTnVtYmVyKGIucGVuZGluZ0Ftb3VudCB8fCAwKTtcbiAgY29uc3QgcGFpZCA9IE51bWJlcihiLnBhaWRBbW91bnQgfHwgMCk7XG4gIGNvbnN0IHBheWFibGUgPSBOdW1iZXIoYi50b3RhbFBheWFibGUgPz8gYi5leHBlY3RlZFJldHVybiA/PyAwKTtcbiAgY29uc3QgZGF5cyA9IG92ZXJkdWVEYXlzKGIpO1xuICBjb25zdCBwaG90byA9IGIucGhvdG9VcmwgfHwgZGVmYXVsdEF2YXRhcjtcbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cImNhcmQgYm9yZGVyLWwtNCBib3JkZXItcmVkLTUwMCBjdXJzb3ItcG9pbnRlciBob3ZlcjpzaGFkb3ctbWQgdHJhbnNpdGlvblwiIG9uQ2xpY2s9e29uT3Blbn0+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgIDxpbWcgc3JjPXtwaG90b30gYWx0PVwiXCIgY2xhc3NOYW1lPVwiaC0xMCB3LTEwIHJvdW5kZWQteGwgb2JqZWN0LWNvdmVyIGJvcmRlciBib3JkZXItc2xhdGUtMjAwIHNocmluay0wXCIgLz5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgbWluLXctMFwiPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cImZvbnQtYmxhY2sgdGV4dC1zbGF0ZS05MDAgdHJ1bmNhdGVcIj57Yi5mdWxsTmFtZX08L3A+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0yIGdhcC14LTIgZ2FwLXktMC41IG10LTEgdGV4dC1bMTFweF0gdGV4dC1zbGF0ZS01MDBcIj5cbiAgICAgICAgICAgIDxzcGFuPlBheWFibGU6IDxiIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNzAwXCI+e21vbmV5KHBheWFibGUpfTwvYj48L3NwYW4+XG4gICAgICAgICAgICA8c3Bhbj5QYWlkOiA8YiBjbGFzc05hbWU9XCJ0ZXh0LWdyZWVuLTcwMFwiPnttb25leShwYWlkKX08L2I+PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4+QmFsOiA8YiBjbGFzc05hbWU9XCJ0ZXh0LXJlZC02MDAgZm9udC1ib2xkXCI+e21vbmV5KHBlbmRpbmcpfTwvYj48L3NwYW4+XG4gICAgICAgICAgICA8c3Bhbj5PdmVyZHVlOiA8YiBjbGFzc05hbWU9XCJ0ZXh0LXJlZC02MDBcIj57ZGF5c30gZGF5czwvYj48L3NwYW4+XG4gICAgICAgICAgICB7Yi5leHRlbnNpb25FbWkgJiYgKFxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJjb2wtc3Bhbi0yIHRleHQtcHJpbWFyeS03MDAgZm9udC1zZW1pYm9sZFwiPkV4dGVuZGVkIEVNSToge21vbmV5KGIuZXh0ZW5zaW9uRW1pKX08L3NwYW4+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMS41IHNocmluay0wXCI+XG4gICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBvcGVuV2hhdHNBcHAoYi5waG9uZSwgd2hhdHNhcHBSZW1pbmRlcihiKSk7IH19XG4gICAgICAgICAgICBjbGFzc05hbWU9XCJyb3VuZGVkLWxnIGJnLWdyZWVuLTUwIHAtMS41IHRleHQtZ3JlZW4tNzAwIGhvdmVyOmJnLWdyZWVuLTEwMFwiPjxNZXNzYWdlQ2lyY2xlIHNpemU9ezEzfSAvPjwvYnV0dG9uPlxuICAgICAgICAgIDxhIGhyZWY9e2B0ZWw6JHtiLnBob25lfWB9IG9uQ2xpY2s9eyhlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpfVxuICAgICAgICAgICAgY2xhc3NOYW1lPVwicm91bmRlZC1sZyBiZy1zbGF0ZS0xMDAgcC0xLjUgdGV4dC1zbGF0ZS02MDAgaG92ZXI6Ymctc2xhdGUtMjAwXCI+PFBob25lIHNpemU9ezEzfSAvPjwvYT5cbiAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IG9uT3BlbigpOyB9fVxuICAgICAgICAgICAgY2xhc3NOYW1lPVwicm91bmRlZC14bCBiZy1yZWQtNjAwIHB4LTMgcHktMiB0ZXh0LXhzIGZvbnQtYmxhY2sgdGV4dC13aGl0ZSBob3ZlcjpiZy1yZWQtNzAwXCI+RXh0ZW5kPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmZ1bmN0aW9uIEJvcnJvd2VyQ2FyZCh7IGIsIHBhaWRUb2RheSwgb25Db2xsZWN0LCBvbk9wZW4gfSkge1xuICBjb25zdCBwYWlkID0gTnVtYmVyKGIucGFpZEFtb3VudCB8fCAwKTtcbiAgY29uc3QgcGVuZGluZyA9IE51bWJlcihiLnBlbmRpbmdBbW91bnQgfHwgMCk7XG4gIGNvbnN0IGVtaSA9IE51bWJlcihiLmVtaSB8fCAwKTtcbiAgY29uc3QgZXhwZWN0ZWQgPSBOdW1iZXIoYi50b3RhbFBheWFibGUgPz8gYi5leHBlY3RlZFJldHVybiA/PyAwKSB8fCAxO1xuICBjb25zdCBwcm9ncmVzcyA9IE1hdGgubWluKDEwMCwgTWF0aC5yb3VuZCgocGFpZCAvIGV4cGVjdGVkKSAqIDEwMCkpO1xuICBjb25zdCBzdGF0dXMgPSBib3Jyb3dlclN0YXR1cyhiKTtcbiAgY29uc3QgcGhvdG8gPSBiLnBob3RvVXJsIHx8IGRlZmF1bHRBdmF0YXI7XG4gIGNvbnN0IHN0b3AgPSAoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBlLnByZXZlbnREZWZhdWx0KCk7IH07XG4gIHJldHVybiAoXG4gICAgPGRpdiByb2xlPVwiYnV0dG9uXCIgdGFiSW5kZXg9ezB9IG9uQ2xpY2s9e29uT3Blbn1cbiAgICAgIG9uS2V5RG93bj17KGUpID0+IChlLmtleSA9PT0gJ0VudGVyJyB8fCBlLmtleSA9PT0gJyAnKSAmJiBvbk9wZW4oKX1cbiAgICAgIGNsYXNzTmFtZT1cImNhcmQgY3Vyc29yLXBvaW50ZXIgc3BhY2UteS0zIHRyYW5zaXRpb24gaG92ZXI6Ym9yZGVyLXByaW1hcnktMjAwIGhvdmVyOnNoYWRvdy1tZCBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6cmluZy0yIGZvY3VzOnJpbmctcHJpbWFyeS0yMDBcIj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cbiAgICAgICAgPGltZyBzcmM9e3Bob3RvfSBhbHQ9XCJcIiBjbGFzc05hbWU9XCJoLTExIHctMTEgcm91bmRlZC14bCBvYmplY3QtY292ZXIgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgc2hyaW5rLTBcIiAvPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBtaW4tdy0wXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBmbGV4LXdyYXBcIj5cbiAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0cnVuY2F0ZSB0ZXh0LWJhc2UgZm9udC1ibGFjayB0ZXh0LXNsYXRlLTkwMFwiPntiLmZ1bGxOYW1lfTwvaDM+XG4gICAgICAgICAgICB7cGFpZFRvZGF5ICYmIDxzcGFuIGNsYXNzTmFtZT1cInJvdW5kZWQtZnVsbCBiZy1ncmVlbi0xMDAgcHgtMiBweS0wLjUgdGV4dC1bMTBweF0gZm9udC1ibGFjayB0ZXh0LWdyZWVuLTcwMFwiPlBhaWQ8L3NwYW4+fVxuICAgICAgICAgICAge3N0YXR1cyA9PT0gJ092ZXJkdWUnICYmICFwYWlkVG9kYXkgJiYgPHNwYW4gY2xhc3NOYW1lPVwicm91bmRlZC1mdWxsIGJnLXJlZC0xMDAgcHgtMiBweS0wLjUgdGV4dC1bMTBweF0gZm9udC1ibGFjayB0ZXh0LXJlZC03MDBcIj5PdmVyZHVlPC9zcGFuPn1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNTAwXCI+e2IucGhvbmV9PC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMS41IHNocmluay0wXCI+XG4gICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoZSkgPT4geyBzdG9wKGUpOyBvcGVuV2hhdHNBcHAoYi5waG9uZSwgd2hhdHNhcHBSZW1pbmRlcihiKSk7IH19XG4gICAgICAgICAgICBjbGFzc05hbWU9XCJyb3VuZGVkLWxnIGJnLWdyZWVuLTUwIHAtMS41IHRleHQtZ3JlZW4tNzAwIGhvdmVyOmJnLWdyZWVuLTEwMFwiPjxNZXNzYWdlQ2lyY2xlIHNpemU9ezEyfSAvPjwvYnV0dG9uPlxuICAgICAgICAgIDxhIGhyZWY9e2B0ZWw6JHtiLnBob25lfWB9IG9uQ2xpY2s9eyhlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpfSBjbGFzc05hbWU9XCJyb3VuZGVkLWxnIGJnLXNsYXRlLTEwMCBwLTEuNSB0ZXh0LXNsYXRlLTYwMCBob3ZlcjpiZy1zbGF0ZS0yMDBcIj48UGhvbmUgc2l6ZT17MTJ9IC8+PC9hPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYi0xIGZsZXgganVzdGlmeS1iZXR3ZWVuIHRleHQteHMgZm9udC1zZW1pYm9sZCB0ZXh0LXNsYXRlLTUwMFwiPjxzcGFuPlByb2dyZXNzPC9zcGFuPjxzcGFuPntwcm9ncmVzc30lPC9zcGFuPjwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImgtMiByb3VuZGVkLWZ1bGwgYmctc2xhdGUtMTAwIG92ZXJmbG93LWhpZGRlblwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPXtgaC0yIHJvdW5kZWQtZnVsbCB0cmFuc2l0aW9uLWFsbCAke3N0YXR1cyA9PT0gJ0NvbXBsZXRlZCcgPyAnYmctZ3JlZW4tNTAwJyA6ICdiZy1wcmltYXJ5LTYwMCd9YH0gc3R5bGU9e3sgd2lkdGg6IGAke3Byb2dyZXNzfSVgIH19IC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBnYXAtMiB0ZXh0LXNtXCI+XG4gICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNjAwXCI+UGFpZDogPGIgY2xhc3NOYW1lPVwidGV4dC1ncmVlbi03MDBcIj57bW9uZXkocGFpZCl9PC9iPjwvc3Bhbj5cbiAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS02MDBcIj5CYWxhbmNlOiA8YiBjbGFzc05hbWU9e3BlbmRpbmcgPiAwID8gJ3RleHQtcmVkLTYwMCcgOiAndGV4dC1ncmVlbi02MDAnfT57bW9uZXkocGVuZGluZyl9PC9iPjwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgICAge2VtaSA+IDAgJiYgcGVuZGluZyA+IDAgJiYgIXBhaWRUb2RheSAmJiAoXG4gICAgICAgIDxidXR0b24gb25DbGljaz17KGUpID0+IHsgc3RvcChlKTsgb25Db2xsZWN0KCk7IH19XG4gICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCB3LWZ1bGwgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yIHJvdW5kZWQteGwgYmctcHJpbWFyeS02MDAgcHktMi41IHRleHQtc20gZm9udC1ibGFjayB0ZXh0LXdoaXRlIGhvdmVyOmJnLXByaW1hcnktNzAwIGFjdGl2ZTpzY2FsZS1bMC45OF0gdHJhbnNpdGlvbi10cmFuc2Zvcm1cIj5cbiAgICAgICAgICA8WmFwIHNpemU9ezE0fSAvPiBDb2xsZWN0IHttb25leShNYXRoLm1pbihlbWksIHBlbmRpbmcpKX1cbiAgICAgICAgPC9idXR0b24+XG4gICAgICApfVxuICAgIDwvZGl2PlxuICApO1xufVxuXG5mdW5jdGlvbiBTdW1tYXJ5Q2FyZCh7IGljb24sIGxhYmVsLCB2YWx1ZSwgY29sb3IgfSkge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPXtgY2FyZCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBwLTMgJHtjb2xvcn1gfT5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2hyaW5rLTBcIj57aWNvbn08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLXctMFwiPlxuICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LVsxMXB4XSBmb250LXNlbWlib2xkIG9wYWNpdHktNzAgdHJ1bmNhdGVcIj57bGFiZWx9PC9wPlxuICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWJhc2UgZm9udC1ibGFjayBsZWFkaW5nLXRpZ2h0XCI+e3ZhbHVlfTwvcD5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuIl19