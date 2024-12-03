import React, { useEffect, useState, useRef } from "react";
import { headers } from "../configs";
import "./HandleRequestPage.css";
import { requestorPath } from "../localconf";
import Popup from '../components/Popup';

const parsePolicy = (policy) => {
  const roleKeys = ["guppy_reader", "storage_reader", "storage_writer", "updater", "deleter"];
  let roles = [];
  let resource = policy;

  roleKeys.forEach((role) => {
    if (policy.includes(`_${role}`)) {
      roles.push(role);
      resource = resource.replace(`_${role}`, "");
    }
  });

  return { resource, roles };
};

const HandleRequestPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [processingPage, setProcessingPage] = useState(1);
  const [processedPage, setProcessedPage] = useState(1);
  const [pageSize, setPageSize] = useState(1);

  const [containerRef, setContainerRef] = useState(null);

  const [showApprovePopup, setShowApprovePopup] = useState(false); // Approve popup state
  const [showRejectPopup, setShowRejectPopup] = useState(false); // Reject popup state
  const [selectedRequest, setSelectedRequest] = useState(null); // Current request being approved/rejected
  const [rejectReason, setRejectReason] = useState(""); // Reason for rejection

  useEffect(() => {
    fetch(`${requestorPath}request`, {
      method: "GET",
      headers: { ...headers },
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch requests: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        setRequests(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const updatePageSize = () => {
    if (containerRef) {
      const containerWidth = containerRef.offsetWidth;
      const cardWidth = 300;
      const cardsPerRow = Math.floor(containerWidth / cardWidth);
      const rowsPerPage = 2;
      const newPageSize = cardsPerRow * rowsPerPage;
      setPageSize(newPageSize > 0 ? newPageSize : 8);
    }
  };

  useEffect(() => {
    updatePageSize();
  }, [containerRef]);

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      await fetch(`${requestorPath}request/${selectedRequest.request_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        credentials: "include",
        body: JSON.stringify({ status: "SIGNED" }),
      });
      alert("Request approved successfully!");
      setShowApprovePopup(false);
      setRequests((prev) =>
        prev.map((req) =>
          req.request_id === selectedRequest.request_id
            ? { ...req, status: "SIGNED" }
            : req
        )
      );
    } catch (error) {
      alert("Failed to approve request.");
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }

    try {
      await fetch(`${requestorPath}request/${selectedRequest.request_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        credentials: "include",
        body: JSON.stringify({ status: "REJECTED", reason: rejectReason }),
      });
      alert("Request rejected successfully!");
      setShowRejectPopup(false);
      setRequests((prev) =>
        prev.map((req) =>
          req.request_id === selectedRequest.request_id
            ? { ...req, status: "REJECTED" }
            : req
        )
      );
    } catch (error) {
      alert("Failed to reject request.");
    }
  };

  const paginate = (data, currentPage) => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  };

  const processingRequests = requests.filter((req) =>
    ["DRAFT", "SUBMITTED"].includes(req.status)
  );
  const processedRequests = requests.filter((req) =>
    ["APPROVED", "SIGNED", "REJECTED"].includes(req.status)
  );

  const paginatedProcessingRequests = paginate(processingRequests, processingPage);
  const paginatedProcessedRequests = paginate(processedRequests, processedPage);

  const renderPagination = (total, currentPage, setPage) => {
    const totalPages = Math.ceil(total / pageSize);
    return (
      <div className="pagination">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            className={`pagination-btn ${page === currentPage ? "active" : ""}`}
            onClick={() => setPage(page)}
          >
            {page}
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div>Loading requests...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Requests</h2>
      <div>
        <h3>Processing Requests</h3>
        <div className="request-container" ref={(containerRef) => setContainerRef(containerRef)}>
          {paginatedProcessingRequests.map((request) => {
            const { resource, roles } = parsePolicy(request.policy_id);
            return (
              <div key={request.request_id} className="request-card">
                <h3 className="request-title">Request ID: {request.request_id}</h3>
                <p><strong>Username:</strong> {request.username}</p>
                <p><strong>Policy:</strong> {request.policy_id}</p>
                <p><strong>Resource:</strong> {resource}</p>
                <p><strong>Request Roles:</strong> {roles.join("; ")}</p>
                <p><strong>Status:</strong> {request.status}</p>
                <p><strong>Request Reason:</strong> {request.reason}</p>
                <p><strong>Created:</strong> {new Date(request.created_time).toLocaleString()}</p>
                <p><strong>Updated:</strong> {new Date(request.updated_time).toLocaleString()}</p>
                <p><strong>Uploaded Files:</strong></p>
                <ul>
                  {Object.entries(request.files || {}).map(([fileId, fileName]) => (
                    <li key={fileId}>
                      <a
                        href={`${requestorPath}request/${request.request_id}/file/${fileId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {fileName}
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="request-actions">
                  <button
                    className="request-action-btn approve"
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowApprovePopup(true);
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="request-action-btn reject"
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowRejectPopup(true);
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {renderPagination(processingRequests.length, processingPage, setProcessingPage)}
      </div>
      <hr />
      <div>
        <h3>Processed Requests</h3>
        <div className="request-container">
          {paginatedProcessedRequests.map((request) => {
            const { resource, roles } = parsePolicy(request.policy_id);
            return (
              <div key={request.request_id} className="request-card">
                <h3 className="request-title">Request ID: {request.request_id}</h3>
                <p><strong>Username:</strong> {request.username}</p>
                <p><strong>Policy:</strong> {request.policy_id}</p>
                <p><strong>Resource:</strong> {resource}</p>
                <p><strong>Request Roles:</strong> {roles.join("; ")}</p>
                <p><strong>Status:</strong> {request.status}</p>
                <p><strong>Request Reason:</strong> {request.reason}</p>
                <p><strong>Created:</strong> {new Date(request.created_time).toLocaleString()}</p>
                <p><strong>Updated:</strong> {new Date(request.updated_time).toLocaleString()}</p>
              </div>
            );
          })}
        </div>
        {renderPagination(processedRequests.length, processedPage, setProcessedPage)}
      </div>

      {/* Approve Popup */}
      {/* {showApprovePopup && (
        <div className="popup">
          <p>Are you sure you want to approve this request?</p>
          <button onClick={handleApprove}>Yes</button>
          <button onClick={() => setShowApprovePopup(false)}>No</button>
        </div>
      )} */}

      {showApprovePopup && (
        <Popup
            message={["Are you sure you want to approve this request?"]}
            // error={jsonToString(userProfile.delete_error)}
            iconName='cross-key'
            title='Inactivate API Key'
            rightButtons={[
                {
                caption: 'Yes',
                fn: handleApprove,
                },
            ]}
            leftButtons={[
                {
                caption: 'No',
                fn: () => setShowApprovePopup(false)
                },
            ]}
            onClose={() => setShowApprovePopup(false)}
        />
      )}

      {/* Reject Popup */}
      {/* {showRejectPopup && (
        <div className="popup">
          <p>Are you sure you want to reject this request?</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection"
          />
          <button onClick={handleReject}>Yes</button>
          <button onClick={() => setShowRejectPopup(false)}>No</button>
        </div>
      )} */}

      {/* Reject Popup */}
      {showRejectPopup && (
        <Popup
          title="Reject Request"
          message={["Are you sure you want to reject this request?"]}
          children={
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection"
              style={{ width: "100%", height: "80px", marginTop: "10px" }}
            />
          }
          rightButtons={[
            {
              caption: "Reject",
              fn: handleReject,
            },
          ]}
          leftButtons={[
            {
              caption: "Cancel",
              fn: () => setShowRejectPopup(false),
            },
          ]}
          onClose={() => setShowRejectPopup(false)}
        />
      )}
    </div>
  );
};

export default HandleRequestPage;
