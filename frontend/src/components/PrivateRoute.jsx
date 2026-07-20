import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import LoadingSpinner from "./common/LoadingSpinner";
import { AuthContext } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
    const { user, loading } = useContext(AuthContext);

    if (loading) return <LoadingSpinner />;

    return user ? children : <Navigate to="/login" replace />;
}
