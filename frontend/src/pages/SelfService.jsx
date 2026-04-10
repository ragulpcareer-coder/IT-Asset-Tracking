import React, { useContext, useEffect, useState } from "react";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import { Card, Button, Input, Badge } from "../components/UI";

export default function SelfService() {
  const { user } = useContext(AuthContext);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const res = await axios.get("/assets?limit=50");
        const list = res.data.assets || res.data || [];
        setAssets(list);
        if (list[0]?._id) setSelectedAsset(list[0]._id);
      } catch (err) {
        toast.error("Unable to load your assets.");
      }
    };
    loadAssets();
  }, []);

  const submitTicket = async (titleOverride) => {
    if (!selectedAsset) return toast.error("Select an asset first.");
    const title = titleOverride || ticketTitle.trim();
    if (!title) return toast.error("Ticket title is required.");
    if (!ticketDesc.trim()) return toast.error("Describe the issue or request.");

    try {
      setLoading(true);
      await axios.post("/tickets", {
        assetId: selectedAsset,
        title,
        description: ticketDesc,
        priority
      });
      toast.success("Ticket submitted successfully.");
      setTicketTitle("");
      setTicketDesc("");
      setPriority("Medium");
    } catch (err) {
      toast.error(err.response?.data?.message || "Ticket submission failed.");
    } finally {
      setLoading(false);
    }
  };

  const requestUpgrade = async () => {
    setTicketTitle("Upgrade Request");
    await submitTicket("Upgrade Request");
  };

  const checkIn = async () => {
    if (!selectedAsset) return toast.error("Select an asset first.");
    setLoading(true);

    const sendCheckIn = async (coords) => {
      try {
        await axios.post("/checkin/asset", {
          assetId: selectedAsset,
          latitude: coords?.latitude,
          longitude: coords?.longitude
        });
        toast.success("Check-in recorded.");
      } catch (err) {
        toast.error(err.response?.data?.message || "Check-in failed.");
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendCheckIn(pos.coords),
        () => sendCheckIn(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      await sendCheckIn(null);
    }
  };

  return (
    <div className="fade-in pb-12">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tighter uppercase">Self-Service Portal</h1>
          <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">
            Submit requests, check in devices, and track your assigned assets.
          </p>
        </div>
        <Badge variant="info">User: {user?.name}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm uppercase tracking-widest text-slate-500 mb-4">Request Support</h3>
          <div className="space-y-4">
            <select
              className="input bg-slate-950/40 border-white/5"
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
            >
              {assets.map((asset) => (
                <option key={asset._id} value={asset._id}>
                  {asset.name} — {asset.serialNumber}
                </option>
              ))}
            </select>
            <Input
              placeholder="Ticket title"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
            />
            <textarea
              className="input bg-slate-950/40 border-white/5 min-h-[120px]"
              placeholder="Describe the issue or request..."
              value={ticketDesc}
              onChange={(e) => setTicketDesc(e.target.value)}
            />
            <select
              className="input bg-slate-950/40 border-white/5"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => submitTicket()} disabled={loading}>Submit Ticket</Button>
              <Button variant="secondary" onClick={requestUpgrade} disabled={loading}>Request Upgrade</Button>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm uppercase tracking-widest text-slate-500 mb-4">Device Check-In</h3>
          <p className="text-slate-400 text-sm mb-4">
            Confirm your device location to keep security posture up to date.
          </p>
          <div className="space-y-4">
            <select
              className="input bg-slate-950/40 border-white/5"
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
            >
              {assets.map((asset) => (
                <option key={asset._id} value={asset._id}>
                  {asset.name} — {asset.serialNumber}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={checkIn} disabled={loading}>Check In Now</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
