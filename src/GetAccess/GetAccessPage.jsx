import React, { useState } from 'react';
import { connect } from 'react-redux';
import Button from '@gen3/ui-component/dist/components/Button';
import { requestorPath } from "../localconf";
import { headers } from "../configs";
import HandleRequestPage from './HandleRequestPage';

// Helper function to check admin privileges
const isAdminUser = (userAuthMapping) => {
  const programsAccess = userAuthMapping['/programs'];
  if (!programsAccess || !Array.isArray(programsAccess)) {
    return false;
  }
  return programsAccess.some(
    (access) =>
      (access.service === '*' && access.method === '*') ||
      (access.service === 'requestor' && access.method === 'update')
  );
};

// Extract programs and projects
const extractProgramsAndProjects = (userAuthMapping) => {
  const programsAndProjects = {};

  Object.keys(userAuthMapping).forEach((key) => {
    const pathSegments = key.split('/').filter(Boolean);
    if (pathSegments.length === 4 && pathSegments[0] === 'programs' && pathSegments[2] === 'projects') {
      const programName = pathSegments[1];
      const projectName = pathSegments[3];
      if (!programsAndProjects[programName]) {
        programsAndProjects[programName] = [];
      }
      programsAndProjects[programName].push(projectName);
    }
  });

  return programsAndProjects;
};

const AccessPage = ({ userAuthMapping, user }) => {
  const [formData, setFormData] = useState({
    program: '',
    project: '',
    accessTypes: [],
    reason: '',
    email: user.email,
    // files: [],
  });
  const [files, setFiles] = useState([]);
  const [biosketchfile, setBiosketchFile] = useState(null);
  const [resume, setResume] = useState(null);
  const [activeTab, setActiveTab] = useState('request'); // Tabs: 'request' or 'admin'
  const [feedbackMessage, setFeedbackMessage] = useState(null); // For success or error messages
  const [isError, setIsError] = useState(false); // To style the message based on success/failure


  const isAdmin = isAdminUser(userAuthMapping); // Check if user is admin
  const programsAndProjects = extractProgramsAndProjects(userAuthMapping);

  // Form handlers
  const handleProgramChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, program: value, project: '' }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccessTypeChange = (e) => {
    const { value, checked } = e.target;
    setFormData((prev) => {
      const updatedAccessTypes = checked
        ? [...prev.accessTypes, value]
        : prev.accessTypes.filter((type) => type !== value);
      return { ...prev, accessTypes: updatedAccessTypes };
    });
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData((prev) => ({ ...prev, files }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // 获取表单数据
    const requestformData = new FormData();
    // 将表单字段添加到 FormData
    requestformData.append("username", formData.email);
    requestformData.append("resource_path", `/programs/${formData.program}/projects/${formData.project}`);
    requestformData.append("reason", formData.reason);
    formData.accessTypes.forEach((accessType) => requestformData.append("role_ids", accessType));
    if (biosketchfile) {
      requestformData.append("biosketchfile", biosketchfile);
    }
    if (resume) {
      requestformData.append("resume", resume);
    }    
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        requestformData.append("files", file); // 与后端的字段名一致
      });
    }

  
    try {
      // Clone headers and remove 'Content-Type'
      const adjustedHeaders = { ...headers };
      delete adjustedHeaders["Content-Type"]; // Let the browser set it for FormData

      const response = await fetch(`${requestorPath}customRequest`, {
        method: "POST",
        headers: adjustedHeaders,
        body: requestformData,
        credentials: 'include',
      });
  
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
  
      const data = await response.json();
      console.log("Request submitted successfully:", data);
      setFeedbackMessage(`Request submitted successfully! Updates would be sent to email ${user.email} once administrator processed the request.`);
      // alert("Request submitted successfully!");
    } catch (error) {
      console.error("Error submitting request:", error);
      setFeedbackMessage("Error submitting request:", error);
      // alert("Error submitting request: " + error.message);
    }
  };

  // Request tab content
  const renderRequestContent = () => (
    <div>
      <h2>Request Project Access</h2>
      {feedbackMessage && (
        <div
          style={{
            color: isError ? 'red' : 'green',
            marginBottom: '10px',
            fontWeight: 'bold',
          }}
        >
          {feedbackMessage}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '15px',
          maxWidth: '600px',
        }}
      >
        <label>
          Program:
          <select
            name="program"
            value={formData.program}
            onChange={handleProgramChange}
            required
            style={{ marginLeft: '10px', padding: '5px' }}
          >
            <option value="">-- Select a program --</option>
            {Object.keys(programsAndProjects).map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </select>
        </label>
        {formData.program && (
          <label>
            Project:
            <select
              name="project"
              value={formData.project}
              onChange={handleInputChange}
              required
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value="">-- Select a project --</option>
              {programsAndProjects[formData.program].map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset style={{ border: 'none' }}>
          <legend style={{ fontSize: '0.875rem' }}>
            Request access role (Choose multiple):
          </legend>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              value="guppy_reader"
              checked={formData.accessTypes.includes('guppy_reader')}
              onChange={handleAccessTypeChange}
            />
            Guppy Reader: Access exploration page data (e.g., summary statistics, filtered metadata)
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              value="storage_reader"
              checked={formData.accessTypes.includes('storage_reader')}
              onChange={handleAccessTypeChange}
            />
            Storage Reader: Download stored files (e.g., BAM, VCF)
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              value="storage_writer"
              checked={formData.accessTypes.includes('storage_writer')}
              onChange={handleAccessTypeChange}
            />
            Storage Writer: Upload files to the storage system
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              value="updater"
              checked={formData.accessTypes.includes('updater')}
              onChange={handleAccessTypeChange}
            />
            Updater: Update project resources
          </label>
          <label style={{ display: 'block' }}>
            <input
              type="checkbox"
              value="deleter"
              checked={formData.accessTypes.includes('deleter')}
              onChange={handleAccessTypeChange}
            />
            Deleter: Delete project resources
          </label>
        </fieldset>
        <label>
          Reason for Request:
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleInputChange}
            required
            style={{
              marginLeft: '10px',
              padding: '5px',
              width: '100%',
              height: '80px',
            }}
          />
        </label>
        <label style={{ display: 'block' }}>
          Upload Related Documents (IRB is required):
          <input
            type="file"
            name="files"
            // onChange={handleFileChange}
            onChange={(e) => setFiles(e.target.files)} // 使用 state 存储文件
            multiple
            required
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
        <label style={{ display: 'block' }}>
          Upload Biosketch (required):
          <input
            type="file"
            name="files"
            // onChange={handleFileChange}
            onChange={(e) => setBiosketchFile(e.target.files[0])} // 使用 state 存储文件\
            required
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
        <label style={{ display: 'block' }}>
          Upload Resume/CV (optional):
          <input
            type="file"
            name="files"
            // onChange={handleFileChange}
            onChange={(e) => setResume(e.target.files[0])} // 使用 state 存储文件\
            required
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
        <Button
          label="Submit"
          buttonType="primary"
          onClick={handleSubmit}
        />
      </form>
    </div>
  );

  return (
    <div style={{ textAlign: 'left', padding: '50px' }}>
      {/* <h1>Access Page</h1> */}
      <div style={{ marginBottom: '20px' }}>
        <button
          className={'g3-unstyle-btn g3-ring-on-focus guppy-explorer__tab'.concat(activeTab === 'request' ? ' guppy-explorer__tab--selected' : '')}
          label="Request Access"
          buttonType={activeTab === 'request' ? 'primary' : 'default'}
          onClick={() => setActiveTab('request')}
        >
          <h3>Request Access</h3>
        </button>
        <button
          className={'g3-unstyle-btn g3-ring-on-focus guppy-explorer__tab'.concat(activeTab === 'admin' ? ' guppy-explorer__tab--selected' : '')}
          label="Admin Panel"
          buttonType={activeTab === 'admin' ? 'primary' : 'default'}
          onClick={() => setActiveTab('admin')}
        >
          <h3>{isAdmin ? "Process Requests (Admin only)" : "Submitted history"}</h3>
        </button>
      </div>
      <div className={'guppy-explorer__main'} style={{padding: "32px", marginTop: "-20px"}}>
        {activeTab === 'request' && renderRequestContent()}
        {activeTab === 'admin' && <HandleRequestPage isAdmin={isAdmin} email={user.email}/>}
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  userAuthMapping: state.userAuthMapping,
  user: state.user,
});

export default connect(mapStateToProps)(AccessPage);
