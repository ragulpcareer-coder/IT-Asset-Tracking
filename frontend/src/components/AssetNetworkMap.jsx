import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import axios from "../utils/axiosConfig";
import LoadingSpinner from "./common/LoadingSpinner";
import { Badge, Button, Card } from "./UI";

const RISK_COLORS = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#ef4444",
  Critical: "#b91c1c"
};

const NODE_COLORS = {
  backbone: "#38bdf8",
  security: "#06b6d4",
  identity: "#6366f1",
  threat: "#ef4444",
  asset: "#64748b"
};

const RISK_LEVELS = ["All", "Low", "Medium", "High", "Critical"];

const getRiskLevel = (asset) => asset?.securityStatus?.riskLevel || "Low";
const isInternalIp = (ip = "") => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(String(ip));

const toArray = (value, candidates = []) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of candidates) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
};

export default function AssetNetworkMap({ onClose }) {
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [showThreatRoutes, setShowThreatRoutes] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assetsRes, alertsRes] = await Promise.allSettled([
          axios.get("/assets?limit=300&sort=riskScore:desc"),
          axios.get("/security/alerts")
        ]);

        if (assetsRes.status === "fulfilled") {
          const list = toArray(assetsRes.value?.data, ["assets", "data"]);
          setAssets(list);
        } else {
          setAssets([]);
        }

        if (alertsRes.status === "fulfilled") {
          const list = toArray(alertsRes.value?.data, ["alerts", "data"]);
          setAlerts(list);
        } else {
          setAlerts([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  const normalizedThreats = useMemo(() => {
    const source = Array.isArray(alerts) ? alerts : [];
    const scoped = source
      .filter((alert) => ["HIGH", "CRITICAL"].includes(String(alert?.severity || "").toUpperCase()))
      .slice(0, 18);

    return scoped.map((alert) => ({
      id: String(alert._id || `${alert.type}-${alert.sourceIp}-${alert.createdAt}`),
      type: alert.type || "Threat",
      severity: String(alert.severity || "MEDIUM").toUpperCase(),
      sourceIp: alert.sourceIp || "Unknown",
      targetAssetId: alert?.metadata?.assetId || null,
      description: alert.description || "No description",
      asn: alert?.metadata?.asn || "Unknown",
      isp: alert?.metadata?.isp || alert?.metadata?.org || "Unknown",
      abuseScore: Number.isFinite(Number(alert?.metadata?.abuseScore)) ? Number(alert.metadata.abuseScore) : 0
    }));
  }, [alerts]);

  useEffect(() => {
    if (loading || !svgRef.current || !wrapperRef.current) return;

    const width = wrapperRef.current.clientWidth || 1200;
    const height = wrapperRef.current.clientHeight || 680;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const graphRoot = svg.append("g");
    svg.call(
      d3.zoom().scaleExtent([0.3, 2.6]).on("zoom", (event) => {
        graphRoot.attr("transform", event.transform);
      })
    );

    const coreNodes = [
      { id: "internet", name: "Internet Edge", zone: "External", nodeType: "backbone", riskLevel: "Medium", riskScore: 45, ipAddress: "Public" },
      { id: "firewall", name: "Perimeter Firewall", zone: "DMZ", nodeType: "security", riskLevel: "Low", riskScore: 12, ipAddress: "Internal" },
      { id: "core", name: "Core Network Switch", zone: "Core", nodeType: "backbone", riskLevel: "Low", riskScore: 8, ipAddress: "Internal" },
      { id: "identity", name: "Identity Services", zone: "Core", nodeType: "identity", riskLevel: "Medium", riskScore: 29, ipAddress: "Internal" }
    ];

    const assetNodes = filteredAssets.map((asset) => ({
      id: `asset:${asset._id}`,
      rawId: String(asset._id),
      name: asset.name || "Unnamed Asset",
      nodeType: "asset",
      zone: isInternalIp(asset.ipAddress) ? "Internal Segment" : "External Segment",
      ipAddress: asset.ipAddress || "N/A",
      assignedTo: asset.assignedTo || "Unassigned",
      riskScore: Number(asset.riskScore || 0),
      riskLevel: getRiskLevel(asset),
      status: asset.status || "available",
      assetType: asset.type || "Device",
      raw: asset
    }));

    const highRiskTargets = assetNodes
      .filter((n) => ["High", "Critical"].includes(n.riskLevel))
      .sort((a, b) => b.riskScore - a.riskScore);

    const threatNodes = showThreatRoutes
      ? normalizedThreats.map((threat, idx) => ({
          id: `threat:${threat.id}`,
          name: threat.type,
          nodeType: "threat",
          zone: "External Threat Source",
          ipAddress: threat.sourceIp,
          riskLevel: threat.severity === "CRITICAL" ? "Critical" : "High",
          riskScore: threat.severity === "CRITICAL" ? 95 : 80,
          asn: threat.asn,
          isp: threat.isp,
          abuseScore: threat.abuseScore,
          description: threat.description,
          mappedTargetId:
            threat.targetAssetId && assetNodes.some((node) => node.rawId === String(threat.targetAssetId))
              ? `asset:${threat.targetAssetId}`
              : (highRiskTargets[idx % Math.max(1, highRiskTargets.length)]?.id || assetNodes[0]?.id || "firewall")
        }))
      : [];

    const nodes = [...coreNodes, ...assetNodes, ...threatNodes];

    const links = [
      { id: "l-internet-firewall", source: "internet", target: "firewall", kind: "backbone", severity: "MEDIUM" },
      { id: "l-firewall-core", source: "firewall", target: "core", kind: "backbone", severity: "LOW" },
      { id: "l-core-identity", source: "core", target: "identity", kind: "backbone", severity: "LOW" },
      ...assetNodes.map((node) => ({
        id: `l-core-${node.id}`,
        source: "core",
        target: node.id,
        kind: "asset",
        severity: node.riskLevel.toUpperCase()
      })),
      ...threatNodes.flatMap((node) => ([
        {
          id: `l-threat-edge-${node.id}`,
          source: node.id,
          target: "firewall",
          kind: "threat",
          severity: node.riskLevel.toUpperCase(),
          description: node.description
        },
        {
          id: `l-threat-target-${node.id}`,
          source: node.id,
          target: node.mappedTargetId,
          kind: "threat",
          severity: node.riskLevel.toUpperCase(),
          description: node.description
        }
      ]))
    ];

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance((d) => (d.kind === "threat" ? 140 : 95)).strength((d) => (d.kind === "backbone" ? 0.7 : 0.55)))
      .force("charge", d3.forceManyBody().strength((d) => (d.nodeType === "threat" ? -500 : -320)))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => (d.nodeType === "threat" ? 22 : 26)));

    const backgroundGrid = graphRoot.append("g").attr("opacity", 0.12);
    for (let x = 0; x < width; x += 120) {
      backgroundGrid.append("line").attr("x1", x).attr("y1", 0).attr("x2", x).attr("y2", height).attr("stroke", "#60a5fa");
    }
    for (let y = 0; y < height; y += 120) {
      backgroundGrid.append("line").attr("x1", 0).attr("y1", y).attr("x2", width).attr("y2", y).attr("stroke", "#60a5fa");
    }

    const linkLayer = graphRoot.append("g");
    const linkSelection = linkLayer
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => {
        if (d.kind === "threat") return "#ef4444";
        if (d.kind === "backbone") return "#38bdf8";
        return "#334155";
      })
      .attr("stroke-width", (d) => (d.kind === "threat" ? 2.6 : 1.6))
      .attr("stroke-opacity", (d) => (d.kind === "threat" ? 0.85 : 0.55))
      .attr("stroke-dasharray", (d) => (d.kind === "threat" ? "7 6" : "none"))
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        setSelectedEdge({
          source: typeof d.source === "string" ? d.source : d.source.id,
          target: typeof d.target === "string" ? d.target : d.target.id,
          kind: d.kind,
          severity: d.severity,
          description: d.description || ""
        });
      });

    const nodeLayer = graphRoot.append("g");
    const nodeSelection = nodeLayer
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        setSelectedNode(d);
      })
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.35).restart();
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

    nodeSelection
      .append("circle")
      .attr("r", (d) => (d.nodeType === "threat" ? 10 : d.nodeType === "asset" ? 16 : 20))
      .attr("fill", (d) => {
        if (d.nodeType === "asset") return RISK_COLORS[d.riskLevel] || NODE_COLORS.asset;
        return NODE_COLORS[d.nodeType] || NODE_COLORS.asset;
      })
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", (d) => (d.nodeType === "threat" ? 1.6 : 1.2))
      .attr("stroke-opacity", 0.4);

    nodeSelection
      .append("circle")
      .attr("r", (d) => (d.nodeType === "threat" ? 16 : 0))
      .attr("fill", "none")
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 1.1)
      .attr("stroke-opacity", (d) => (d.nodeType === "threat" ? 0.5 : 0));

    nodeSelection
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 32)
      .attr("font-size", "10px")
      .attr("font-weight", "700")
      .attr("fill", "#cbd5e1")
      .text((d) => (d.name.length > 22 ? `${d.name.slice(0, 22)}...` : d.name));

    nodeSelection
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", "9px")
      .attr("font-weight", "800")
      .attr("fill", "#0b1220")
      .text((d) => {
        if (d.nodeType === "asset") return Math.round(d.riskScore || 0);
        if (d.nodeType === "threat") return "!";
        return d.nodeType.slice(0, 3).toUpperCase();
      });

    const dashTimer = d3.interval(() => {
      linkSelection
        .filter((d) => d.kind === "threat")
        .attr("stroke-dashoffset", (_, i) => ((Date.now() / 32 + i * 4) % 28));
    }, 80);

    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodeSelection.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      dashTimer.stop();
      simulation.stop();
    };
  }, [loading, filteredAssets, normalizedThreats, showThreatRoutes]);

  if (loading) return <LoadingSpinner message="Building network topology graph..." />;

  const stats = {
    totalAssets: filteredAssets.length,
    highRiskAssets: filteredAssets.filter((a) => ["High", "Critical"].includes(getRiskLevel(a))).length,
    threatRoutes: showThreatRoutes ? normalizedThreats.length : 0,
    unmanaged: filteredAssets.filter((a) => !a.assignedTo).length
  };

  const recentThreats = normalizedThreats.slice(0, 6);

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-md flex flex-col">
      <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-white text-lg font-black tracking-tight uppercase">Network Topology Intelligence</h2>
          <p className="text-slate-400 text-xs">Structured asset graph with attack routes, risk overlays, and live context</p>
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
              <option key={level} value={level}>
                {level === "All" ? "All Risk Levels" : level}
              </option>
            ))}
          </select>
          <Button
            variant={showThreatRoutes ? "danger" : "secondary"}
            size="sm"
            onClick={() => setShowThreatRoutes((prev) => !prev)}
          >
            {showThreatRoutes ? "Hide Threat Routes" : "Show Threat Routes"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-4 flex-1 min-h-0">
        <div ref={wrapperRef} className="col-span-12 xl:col-span-8 min-h-[520px]">
          <Card className="h-full p-0 overflow-hidden border-white/10 bg-slate-900/30">
            <svg ref={svgRef} className="w-full h-full" />
          </Card>
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-4 overflow-y-auto pr-1">
          <Card className="p-4 border-white/10 bg-slate-900/40">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Network Summary</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Visible Assets</span><span className="text-white font-bold">{stats.totalAssets}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">High Risk Assets</span><span className="text-red-400 font-bold">{stats.highRiskAssets}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Threat Routes</span><span className="text-amber-400 font-bold">{stats.threatRoutes}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Unmanaged Assets</span><span className="text-cyan-400 font-bold">{stats.unmanaged}</span></div>
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
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Selected Node</div>
            {selectedNode ? (
              <div className="space-y-2 text-xs">
                <div className="text-white font-bold text-sm">{selectedNode.name}</div>
                <div className="flex justify-between"><span className="text-slate-500">Zone</span><span className="text-slate-200">{selectedNode.zone || "Unknown"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">IP</span><span className="text-slate-200 font-mono">{selectedNode.ipAddress || "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Risk Score</span><span className="text-slate-200">{Math.round(Number(selectedNode.riskScore || 0))}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Risk Level</span><Badge variant={["High", "Critical"].includes(selectedNode.riskLevel) ? "danger" : "warning"}>{selectedNode.riskLevel || "Low"}</Badge></div>
                {selectedNode.nodeType === "threat" && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-500">ASN</span><span className="text-slate-200">{selectedNode.asn || "Unknown"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">ISP</span><span className="text-slate-200">{selectedNode.isp || "Unknown"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Abuse Score</span><span className="text-red-300 font-bold">{selectedNode.abuseScore || 0}/100</span></div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-xs">Select a node to inspect security context and network metadata.</p>
            )}
          </Card>

          <Card className="p-4 border-white/10 bg-slate-900/40">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Selected Route</div>
            {selectedEdge ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-slate-200 uppercase">{selectedEdge.kind}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Severity</span><Badge variant={["HIGH", "CRITICAL"].includes(selectedEdge.severity) ? "danger" : "warning"}>{selectedEdge.severity || "MEDIUM"}</Badge></div>
                <div className="text-slate-400 break-words">{selectedEdge.description || "No additional route description."}</div>
              </div>
            ) : (
              <p className="text-slate-500 text-xs">Select a route line to review path-level security information.</p>
            )}
          </Card>

          <Card className="p-4 border-white/10 bg-slate-900/40">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Recent Threat Events</div>
            {recentThreats.length === 0 ? (
              <p className="text-slate-500 text-xs">No high-severity threat routes detected in current telemetry.</p>
            ) : (
              <div className="space-y-2">
                {recentThreats.map((threat) => (
                  <div key={threat.id} className="rounded border border-red-500/20 bg-red-500/5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] text-red-200 font-semibold truncate">{threat.type}</div>
                      <Badge variant="danger">{threat.severity}</Badge>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">{threat.sourceIp}</div>
                    <div className="text-[10px] text-slate-500 mt-1 truncate">{threat.description}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
