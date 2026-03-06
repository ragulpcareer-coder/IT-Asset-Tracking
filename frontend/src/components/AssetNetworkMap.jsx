import React, { useEffect, useRef, useState, useContext } from "react";
import * as d3 from "d3";
import axios from "../utils/axiosConfig";
import { AuthContext } from "../context/AuthContext";
import LoadingSpinner from "./common/LoadingSpinner";

/**
 * AssetNetworkMap — D3 Force-Directed Graph
 * Renders all registered assets as nodes connected to a central server node.
 * Node color = risk level. Click a node to see asset details.
 */

const RISK_COLORS = {
    Low: "#22c55e",
    Medium: "#eab308",
    High: "#ef4444",
    Critical: "#dc2626",
};

const STATUS_LABEL = {
    available: "Available",
    assigned: "Assigned",
    maintenance: "Maintenance",
    lost: "Lost",
    retired: "Retired",
};

export default function AssetNetworkMap({ onClose }) {
    const svgRef = useRef(null);
    const { user } = useContext(AuthContext);
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tooltip, setTooltip] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);

    useEffect(() => {
        axios.get("/assets")
            .then(res => {
                const list = Array.isArray(res.data) ? res.data : (res.data.assets || []);
                setAssets(list);
            })
            .catch(() => setAssets([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (loading || !svgRef.current || assets.length === 0) return;

        const container = svgRef.current.parentElement;
        const W = container.clientWidth || 800;
        const H = container.clientHeight || 500;

        // Clear previous render
        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current)
            .attr("width", W)
            .attr("height", H);

        // Zoom + pan
        const g = svg.append("g");
        svg.call(d3.zoom().scaleExtent([0.3, 3]).on("zoom", (e) => {
            g.attr("transform", e.transform);
        }));

        // Build nodes: central server + all assets
        const centerNode = { id: "__server__", label: "Server", type: "server", isCenter: true };
        const assetNodes = assets.map(a => ({
            id: a._id,
            label: a.name,
            type: a.type || "Device",
            status: a.status,
            riskScore: a.riskScore ?? 0,
            riskLevel: a.securityStatus?.riskLevel || "Low",
            assignedTo: a.assignedTo,
            classification: a.classification,
            _raw: a,
        }));

        const nodes = [centerNode, ...assetNodes];
        const links = assetNodes.map(n => ({ source: "__server__", target: n.id }));

        // Force simulation
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(120).strength(0.8))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(W / 2, H / 2))
            .force("collision", d3.forceCollide(45));

        // Draw links
        const link = g.append("g")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", "#ffffff15")
            .attr("stroke-width", 1.5);

        // Draw node groups
        const node = g.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("cursor", d => d.isCenter ? "default" : "pointer")
            .call(
                d3.drag()
                    .on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                    .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
                    .on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
            )
            .on("click", (e, d) => { if (!d.isCenter) setSelectedAsset(d._raw); });

        // Node circles
        node.append("circle")
            .attr("r", d => d.isCenter ? 28 : 20)
            .attr("fill", d => d.isCenter ? "#3b82f6" : (RISK_COLORS[d.riskLevel] || "#6b7280"))
            .attr("fill-opacity", 0.85)
            .attr("stroke", d => d.isCenter ? "#60a5fa" : "#ffffff20")
            .attr("stroke-width", 2);

        // Server icon text in center
        node.filter(d => d.isCenter).append("text")
            .attr("text-anchor", "middle").attr("dy", "0.35em")
            .attr("font-size", "18px").attr("fill", "white").text("🖥");

        // Asset icon text
        node.filter(d => !d.isCenter).append("text")
            .attr("text-anchor", "middle").attr("dy", "0.35em")
            .attr("font-size", "12px").attr("fill", "white")
            .text(d => {
                const t = (d.type || "").toLowerCase();
                if (t.includes("laptop")) return "💻";
                if (t.includes("server")) return "🖥";
                if (t.includes("phone") || t.includes("mobile")) return "📱";
                if (t.includes("router") || t.includes("network")) return "🌐";
                return "🔲";
            });

        // Labels below each node
        node.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "38px")
            .attr("font-size", "10px")
            .attr("font-weight", "600")
            .attr("fill", "#e2e8f0")
            .text(d => d.label?.length > 14 ? d.label.slice(0, 13) + "…" : d.label);

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        return () => simulation.stop();
    }, [loading, assets]);

    if (loading) return <LoadingSpinner message="Loading network map..." />;

    return (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#050505]">
                <div>
                    <h2 className="text-white font-bold text-lg">📡 Asset Network Map</h2>
                    <p className="text-gray-500 text-xs mt-0.5">
                        {assets.length} assets connected — click a node to view details
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Legend */}
                    <div className="hidden md:flex items-center gap-3 text-xs">
                        {Object.entries(RISK_COLORS).map(([level, color]) => (
                            <span key={level} className="flex items-center gap-1.5">
                                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-gray-400">{level}</span>
                            </span>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition"
                    >
                        ✕ Close
                    </button>
                </div>
            </div>

            {/* Graph */}
            <div className="flex-1 relative overflow-hidden">
                <svg ref={svgRef} className="w-full h-full" />
            </div>

            {/* Asset Detail Panel */}
            {selectedAsset && (
                <div className="absolute bottom-6 left-6 bg-[#0a0a0a] border border-white/10 rounded-xl p-5 w-72 shadow-2xl">
                    <div className="flex items-start justify-between mb-3">
                        <h3 className="text-white font-bold text-sm">{selectedAsset.name}</h3>
                        <button onClick={() => setSelectedAsset(null)} className="text-gray-500 hover:text-white text-lg leading-none">×</button>
                    </div>
                    <div className="space-y-2 text-xs">
                        {[
                            ["Type", selectedAsset.type],
                            ["Status", STATUS_LABEL[selectedAsset.status] || selectedAsset.status],
                            ["Assigned To", selectedAsset.assignedTo || "Unassigned"],
                            ["Classification", selectedAsset.classification],
                            ["Risk Score", `${selectedAsset.riskScore ?? 0} / 100`],
                            ["Risk Level", selectedAsset.securityStatus?.riskLevel || "Low"],
                        ].map(([label, value]) => (
                            <div key={label} className="flex justify-between">
                                <span className="text-gray-500">{label}</span>
                                <span className="text-gray-200 font-medium">{value || "—"}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
