import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, Button, Input } from "./UI";
import useDraftState from "../hooks/useDraftState";
import { hasValidationErrors, validateAssetForm } from "../utils/formValidation";

const DEFAULT_FORM_STATE = {
  name: "",
  type: "",
  serialNumber: "",
  status: "available",
  classification: "Internal",
  assignedTo: "",
  purchasePrice: 0,
  usefulLifeYears: 5,
};

export default function AssetModal({ isOpen, onClose, onSubmit, initialData }) {
  const storageKey = useMemo(
    () => (initialData?._id ? `asset-edit-draft-${initialData._id}` : "asset-create-draft"),
    [initialData?._id]
  );
  const [formData, setFormData, clearDraft] = useDraftState(storageKey, DEFAULT_FORM_STATE);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const dialogRef = React.useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData({
        ...DEFAULT_FORM_STATE,
        ...initialData,
        assignedTo: initialData.assignedTo || "",
      });
    } else {
      setFormData(DEFAULT_FORM_STATE);
    }

    setErrors({});
    setSubmitError("");
    setIsDirty(false);
  }, [initialData, isOpen, setFormData]);

  const validate = (nextState = formData) => {
    const nextErrors = validateAssetForm(nextState);
    setErrors(nextErrors);
    return !hasValidationErrors(nextErrors);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextState = { ...formData, [name]: value };
    setFormData(nextState);
    setIsDirty(true);
    setSubmitError("");
    setErrors((prev) => ({ ...prev, [name]: validateAssetForm(nextState)[name] || "" }));
  };

  const handleClose = () => {
    if (isDirty && !loading && !window.confirm("Discard unsaved asset changes?")) {
      return;
    }
    if (isDirty) {
      clearDraft();
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActive = document.activeElement;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      const focusable = dialogRef.current?.querySelectorAll(focusableSelector);
      if (focusable?.length) {
        focusable[0].focus();
      }
    };

    focusFirst();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActive?.focus?.();
    };
  }, [handleClose, isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSubmitError("");
    try {
      await onSubmit({
        ...formData,
        purchasePrice: Number(formData.purchasePrice) || 0,
        usefulLifeYears: Number(formData.usefulLifeYears) || 5,
      });
      clearDraft();
      onClose();
    } catch (error) {
      setSubmitError(error?.response?.data?.message || "We could not save this asset. Please review the fields and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-xl"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="card my-10 w-full max-w-2xl border-white/10 bg-slate-950"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-modal-title"
            ref={dialogRef}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-8 flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 id="asset-modal-title" className="text-xl font-extrabold tracking-tight text-white">
                  {initialData ? "Metadata Overhaul" : "Register New Node"}
                </h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Enterprise Inventory Authority
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClose} aria-label="Close asset form">
                Close
              </Button>
            </div>

            <form onSubmit={handleSubmit}>
              {submitError && <Alert type="error" message={submitError} className="mb-6" onClose={() => setSubmitError("")} />}

              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                <Input
                  id="asset-name"
                  label="Node Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="MacBook Pro / AWS Edge Server"
                  error={errors.name}
                  required
                />
                <Input
                  id="asset-type"
                  label="Category / Cluster"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  placeholder="Laptop, Host, Gateway..."
                  error={errors.type}
                  required
                />
                <Input
                  id="asset-serial"
                  label="Registry Serial (SN)"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleChange}
                  placeholder="SN-XXXXX-XXXXX"
                  error={errors.serialNumber}
                  required
                  disabled={!!initialData}
                />
                <div className="form-group">
                  <label className="label" htmlFor="asset-status">Operational Status</label>
                  <select
                    id="asset-status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="input appearance-none bg-slate-900 border-white/10"
                  >
                    <option value="available">Available / Inventory</option>
                    <option value="assigned">Assigned / Locked</option>
                    <option value="maintenance">Maintenance / Offline</option>
                    <option value="retired">Retired / Decommissioned</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="asset-classification">Encryption Classification</label>
                  <select
                    id="asset-classification"
                    name="classification"
                    value={formData.classification}
                    onChange={handleChange}
                    className="input appearance-none bg-slate-900 border-white/10"
                  >
                    <option value="Public">Level 0: Public</option>
                    <option value="Internal">Level 1: Internal</option>
                    <option value="Confidential">Level 2: Confidential</option>
                    <option value="Restricted">Level 3: Restricted</option>
                  </select>
                </div>
                <Input
                  id="asset-assigned-to"
                  label="Assigned Target (Email)"
                  name="assignedTo"
                  value={formData.assignedTo}
                  onChange={handleChange}
                  placeholder="user@enterprise.com"
                  error={errors.assignedTo}
                />
                <Input
                  id="asset-price"
                  label="Acquisition Cost ($)"
                  name="purchasePrice"
                  type="number"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  error={errors.purchasePrice}
                />
                <Input
                  id="asset-life"
                  label="Useful Service Life (Years)"
                  name="usefulLifeYears"
                  type="number"
                  value={formData.usefulLifeYears}
                  onChange={handleChange}
                  placeholder="5"
                  error={errors.usefulLifeYears}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-white/5 pt-6">
                <Button variant="secondary" onClick={handleClose} disabled={loading}>
                  Abort Operation
                </Button>
                <Button type="submit" variant="primary" loading={loading}>
                  {initialData ? "Apply Protocol" : "Initialize Node"}
                </Button>
              </div>

              {isDirty && !loading && (
                <p className="mt-3 text-xs text-slate-400">Draft saved locally on this device.</p>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
