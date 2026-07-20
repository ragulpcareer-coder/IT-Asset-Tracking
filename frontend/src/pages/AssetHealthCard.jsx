import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "../utils/axiosConfig";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card, Badge } from "../components/UI";

export default function AssetHealthCard() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`/public/assets/${id}/health`);
        setAsset(res.data?.asset || null);
      } catch (err) {
        setAsset(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <LoadingSpinner fullScreen message="Loading asset health card..." />;

  if (!asset) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <Card className="max-w-lg w-full text-center">
          <h2 className="text-xl font-bold text-white">Asset Not Found</h2>
          <p className="text-slate-400 text-sm mt-2">This QR code does not match an active asset record.</p>
          <Link to="/login" className="btn btn-primary mt-4 inline-block">Login</Link>
        </Card>
      </div>
    );
  }

  const riskVariant =
    asset.riskLevel === "Critical" ? "danger" :
      asset.riskLevel === "High" ? "warning" :
        asset.riskLevel === "Medium" ? "info" : "success";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-white">{asset.name}</h1>
              <p className="text-slate-400 text-sm mt-1">Asset Health Card</p>
            </div>
            <div className="flex gap-2 items-center">
              <Badge variant={riskVariant}>{asset.riskLevel} Risk</Badge>
              <Badge variant={asset.status === "assigned" ? "info" : "success"}>{asset.status}</Badge>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-sm uppercase tracking-widest text-slate-500 mb-3">Identity</h3>
            <div className="text-sm space-y-2">
              <div><span className="text-slate-500">Type:</span> {asset.type}</div>
              <div><span className="text-slate-500">Classification:</span> {asset.classification}</div>
              <div><span className="text-slate-500">Record:</span> Verified public asset record</div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm uppercase tracking-widest text-slate-500 mb-3">Lifecycle</h3>
            <div className="text-sm space-y-2">
              <div><span className="text-slate-500">Warranty:</span> {asset.warrantyState || "unknown"}</div>
              <div><span className="text-slate-500">Replacement:</span> {asset.needsReplacement ? "Recommended" : "OK"}</div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm uppercase tracking-widest text-slate-500 mb-3">Security</h3>
            <div className="text-sm space-y-2">
              <div><span className="text-slate-500">Risk Level:</span> {asset.riskLevel}</div>
              <div><span className="text-slate-500">Public Detail:</span> Limited for privacy</div>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm uppercase tracking-widest text-slate-500 mb-3">Health</h3>
            <div className="text-sm space-y-2">
              <div><span className="text-slate-500">Status:</span> {asset.status}</div>
              <div><span className="text-slate-500">Telemetry:</span> Available after sign-in</div>
            </div>
          </Card>
        </div>

        <div className="mt-8 flex justify-center">
          <Link to="/login" className="btn btn-secondary">Login to Manage Assets</Link>
        </div>
      </div>
    </div>
  );
}
