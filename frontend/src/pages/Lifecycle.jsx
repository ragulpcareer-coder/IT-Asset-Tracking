import React, { useEffect, useState } from "react";
import axios from "../utils/axiosConfig";
import { ToastContainer, toast } from "react-toastify";
import { Button, Card, Input, Badge, ConfirmModal } from "../components/UI";

export default function Lifecycle() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [receiveTarget, setReceiveTarget] = useState(null);

  const [form, setForm] = useState({
    assetType: "",
    quantity: 1,
    justification: "",
    vendor: ""
  });

  const [receiveForm, setReceiveForm] = useState({
    name: "",
    serialNumber: "",
    macAddress: "",
    purchaseDate: "",
    purchasePrice: "",
    usefulLifeYears: 3
  });

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/procurement/requests");
      setRequests(res.data?.requests || []);
    } catch (err) {
      toast.error("Failed to load procurement requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const submitRequest = async () => {
    if (!form.assetType.trim()) return toast.error("Asset type is required.");
    try {
      await axios.post("/procurement/requests", form);
      toast.success("Procurement request submitted.");
      setForm({ assetType: "", quantity: 1, justification: "", vendor: "" });
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Request failed.");
    }
  };

  const approveRequest = async () => {
    if (!approveTarget) return;
    try {
      await axios.put(`/procurement/requests/${approveTarget._id}/approve`, {
        vendor: approveTarget.vendor,
        poNumber: approveTarget.poNumber
      });
      toast.success("Request approved.");
      setApproveTarget(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed.");
    }
  };

  const rejectRequest = async (req) => {
    try {
      await axios.put(`/procurement/requests/${req._id}/reject`);
      toast.info("Request rejected.");
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed.");
    }
  };

  const receiveRequest = async () => {
    if (!receiveTarget) return;
    if (!receiveForm.serialNumber.trim()) return toast.error("Serial number is required.");
    try {
      await axios.post(`/procurement/requests/${receiveTarget._id}/receive`, {
        assets: [{
          name: receiveForm.name || `${receiveTarget.assetType} (${receiveForm.serialNumber})`,
          serialNumber: receiveForm.serialNumber,
          macAddress: receiveForm.macAddress,
          purchaseDate: receiveForm.purchaseDate,
          purchasePrice: receiveForm.purchasePrice,
          usefulLifeYears: receiveForm.usefulLifeYears
        }]
      });
      toast.success("Asset received and tagged.");
      setReceiveTarget(null);
      setReceiveForm({ name: "", serialNumber: "", macAddress: "", purchaseDate: "", purchasePrice: "", usefulLifeYears: 3 });
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Receiving failed.");
    }
  };

  return (
    <div className="fade-in pb-12">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />

      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-white tracking-tighter uppercase">Asset Lifecycle</h1>
        <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">
          Request → Receive → Deploy → Maintain → Retire
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <Card>
          <h3 className="text-sm uppercase tracking-widest text-slate-500 mb-4">Request & Procurement</h3>
          <div className="space-y-4">
            <Input
              placeholder="Asset Type (Laptop / Server / License)"
              value={form.assetType}
              onChange={(e) => setForm({ ...form, assetType: e.target.value })}
            />
            <Input
              placeholder="Quantity"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
            <Input
              placeholder="Preferred Vendor (optional)"
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            />
            <textarea
              className="input bg-slate-950/40 border-white/5 min-h-[120px]"
              placeholder="Justification / Requirement details"
              value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
            />
            <Button variant="primary" onClick={submitRequest}>Submit Request</Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm uppercase tracking-widest text-slate-500 mb-4">Receiving & Tagging</h3>
          <p className="text-slate-400 text-sm mb-4">
            Select a request below and receive the asset with serial/MAC details.
          </p>
          <div className="space-y-3">
            <Input
              placeholder="Asset Name (optional)"
              value={receiveForm.name}
              onChange={(e) => setReceiveForm({ ...receiveForm, name: e.target.value })}
            />
            <Input
              placeholder="Serial Number"
              value={receiveForm.serialNumber}
              onChange={(e) => setReceiveForm({ ...receiveForm, serialNumber: e.target.value })}
            />
            <Input
              placeholder="MAC Address"
              value={receiveForm.macAddress}
              onChange={(e) => setReceiveForm({ ...receiveForm, macAddress: e.target.value })}
            />
            <Input
              placeholder="Purchase Date"
              type="date"
              value={receiveForm.purchaseDate}
              onChange={(e) => setReceiveForm({ ...receiveForm, purchaseDate: e.target.value })}
            />
            <Input
              placeholder="Purchase Price"
              type="number"
              value={receiveForm.purchasePrice}
              onChange={(e) => setReceiveForm({ ...receiveForm, purchasePrice: e.target.value })}
            />
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="text-sm uppercase tracking-wider text-white font-bold">Procurement Requests</div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">No requests yet.</td>
                </tr>
              )}
              {requests.map((req) => (
                <tr key={req._id}>
                  <td>
                    <div className="text-xs text-white font-bold">{req.requesterName}</div>
                    <div className="text-[10px] text-slate-500">{req.requesterEmail}</div>
                  </td>
                  <td className="text-xs text-slate-300">{req.assetType}</td>
                  <td className="text-xs text-slate-300">{req.quantity}</td>
                  <td><Badge variant={req.status === "RECEIVED" ? "success" : req.status === "APPROVED" ? "info" : "warning"}>{req.status}</Badge></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setApproveTarget(req)}>Approve</Button>
                      <Button variant="secondary" size="sm" onClick={() => setReceiveTarget(req)}>Receive</Button>
                      <Button variant="danger" size="sm" onClick={() => rejectRequest(req)}>Reject</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmModal
        isOpen={!!approveTarget}
        title="Approve request?"
        message="This will move the request to Approved status."
        confirmText="Approve"
        onConfirm={approveRequest}
        onCancel={() => setApproveTarget(null)}
      />

      <ConfirmModal
        isOpen={!!receiveTarget}
        title="Receive asset?"
        message="This will create a new asset record and mark the request as received."
        confirmText="Receive"
        onConfirm={receiveRequest}
        onCancel={() => setReceiveTarget(null)}
      />
    </div>
  );
}
