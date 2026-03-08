import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import axios from "../utils/axiosConfig";
import LoadingSpinner from "./common/LoadingSpinner";
import { Button, Card, Badge } from "./UI";

const RISK_COLORS = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#ef4444",
  Critical: "#b91c1c",
};

const RISK_LEVELS = ["All", "Low", "Medium", "High", "Critical"];

const getRiskLevel = (asset) => asset?.securityStatus?.riskLevel || "Low";

export default function AssetNetworkMap({ onClose }) {
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await axios.get("/assets?limit=300&sort=riskScore:desc");
        const list = Array.isArray(res.data?.assets) ? res.data.assets : Array.isArray(res.data) ? res.data : [];
        setAssets(list);
      } catch {
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, []);

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesRisk = riskFilter === "All" || getRiskLevel(asset) === riskFilter;
      if (!matchesRisk) return false;
      if (!term) return true;

      return [asset.name, asset.ipAddress, asset.assignedTo, asset.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [assets, search, riskFilter]);

  useEffect(() => {
    if (loading || !svgRef.current || !wrapperRef.current) return;

    const width = wrapperRef.current.clientWidth || 1200;
    const height = wrapperRef.current.clientHeight || 620;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const graphRoot = svg.append("g");
    svg.call(
      d3.zoom().scaleExtent([0.35, 2.5]).on("zoom", (event) => {
        graphRoot.attr("transform", event.transform);
      })
    );

    const hub = {
      id: "hub",
      name: "Core Network",
      type: "hub",
      riskLevel: "Low",
      riskScore: 0,
      ipAddress: "internal",
    };

    const nodes = [
      hub,
      ...filteredAssets.map((asset) => ({
        id: asset._id,
        name: asset.name || "Unnamed Asset",
        type: asset.type || "Device",
        ipAddress: asset.ipAddress || "N/A",
        assignedTo: asset.assignedTo || "Unassigned",
        riskScore: Number(asset.riskScore || 0),
        riskLevel: getRiskLevel(asset),
        status: asset.status || "available",
        raw: asset,
      })),
    ];

    const links = nodes
      .filter((node) => node.id !== "hub")
      .map((node) => ({ source: "hub", target: node.id }));

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(120).strength(0.45))
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => (d.id === "hub" ? 34 : 24)));

    const linkLayer = graphRoot.append("g").attr("stroke", "#334155").attr("stroke-opacity", 0.45);
    const linksSel = linkLayer
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.2);

    const nodeLayer = graphRoot.append("g");
    const node = nodeLayer
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "asset-node")
      .style("cursor", (d) => (d.id === "hub" ? "default" : "pointer"))
      .on("click", (_, d) => {
        if (d.raw) setSelectedAsset(d.raw);
      })
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", (d) => (d.id === "hub" ? 26 : 18))
      .attr("fill", (d) => (d.id === "hub" ? "#0ea5e9" : RISK_COLORS[d.riskLevel] || "#64748b"))
      .attr("stroke", "#e2e8f0")
      .attr("stroke-opacity", 0.25)
      .attr("stroke-width", 1.2);

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (d.id === "hub" ? 40 : 32))
      .attr("font-size", "10px")
      .attr("font-weight", "700")
      .attr("fill", "#cbd5e1")
      .text((d) => (d.name.length > 16 ? `${d.name.slice(0, 16)}...` : d.name));

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", (d) => (d.id === "hub" ? "11px" : "9px"))
      .attr("font-weight", "700")
      .attr("fill", "#0f172a")
      .text((d) => (d.id === "hub" ? "HUB" : Math.round(d.riskScore || 0)));

    simulation.on("tick", () => {
      linksSel
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [loading, filteredAssets]);

  if (loading) return <LoadingSpinner message="Loading network topology..." />;

  const stats = {
    total: filteredAssets.length,
    highRisk: filteredAssets.filter((a) => ["High", "Critical"].includes(getRiskLevel(a))).length,
    unassigned: filteredAssets.filter((a) => !a.assignedTo).length,
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-md flex flex-col">
      <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-white text-lg font-black tracking-tight uppercase">Network Topology</h2>
          <p className="text-slate-400 text-xs">Interactive asset graph with risk visualization</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search asset, IP, owner"
            className="input h-9 w-56 bg-slate-900 border-white/10 text-xs"
          />
          <select
            className="input h-9 w-36 bg-slate-900 border-white/10 text-xs"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>{level === "All" ? "All Risk Levels" : level}</option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4 flex-1 min-h-0">
        <div ref={wrapperRef} className="col-span-12 md:col-span-9 min-h-[520px]">
          <Card className="h-full p-0 overflow-hidden border-white/10 bg-slate-900/30">
            <svg ref={svgRef} className="w-full h-full" />
          </Card>
        </div>

        <div className="col-span-12 md:col-span-3 space-y-4 overflow-y-auto pr-1">
          <Card className="p-4 border-white/10 bg-slate-900/40">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Live Summary</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Visible Assets</span><span className="text-white font-bold">{stats.total}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">High Risk</span><span className="text-red-400 font-bold">{stats.highRisk}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Unassigned</span><span className="text-amber-400 font-bold">{stats.unassigned}</span></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(RISK_COLORS).map(([label, color]) => (
                <span key={label} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </Card>

          <Card className="p-4 border-white/10 bg-slate-900/40">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Selected Asset</div>
            {selectedAsset ? (
              <div className="space-y-2 text-xs">
                <div className="text-white font-bold text-sm">{selectedAsset.name}</div>
                <div className="flex justify-between"><span className="text-slate-500">IP</span><span className="text-slate-200 font-mono">{selectedAsset.ipAddress || "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-slate-200">{selectedAsset.type || "Unknown"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="text-slate-200">{selectedAsset.status || "available"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Assigned</span><span className="text-slate-200">{selectedAsset.assignedTo || "Unassigned"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Risk</span><Badge variant={["High", "Critical"].includes(getRiskLevel(selectedAsset)) ? "danger" : "warning"}>{getRiskLevel(selectedAsset)}</Badge></div>
              </div>
            ) : (
              <p className="text-slate-500 text-xs">Select a node from the graph to inspect asset details.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
