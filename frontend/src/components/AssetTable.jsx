import React from "react";

export default function AssetTable({ assets, onEdit, onDelete, user }) {
    if (!assets.length) {
        return <div className="p-4 text-center text-gray-500">No assets found.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Assigned To
                        </th>
                        {user?.role === "Admin" && (
                            <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {assets.map((asset) => (
                        <tr key={asset._id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                                {asset.name}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">{asset.type}</td>
                            <td className="py-3 px-4 text-sm">
                                <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                  ${asset.status === "available"
                                            ? "bg-green-100 text-green-800"
                                            : asset.status === "assigned"
                                                ? "bg-blue-100 text-blue-800"
                                                : "bg-gray-100 text-gray-800"
                                        }`}
                                >
                                    {asset.status}
                                </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                                {asset.assignedTo || "-"}
                            </td>
                            {user?.role === "Admin" && (
                                <td className="py-3 px-4 text-right text-sm font-medium">
                                    <button
                                        onClick={() => onEdit(asset)}
                                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => onDelete(asset._id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        Delete
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
