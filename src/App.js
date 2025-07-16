import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { FiUpload, FiDownload, FiPlay, FiSquare, FiSun, FiMoon, FiHelpCircle, FiUsers, FiTrash2 } from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import { List } from 'react-virtualized';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { convertCSVtoJSON } from './convertCSVtoJSON';

// Register Chart.js components
ChartJS.register(ArcElement, ChartTooltip, Legend);

// Configure axios defaults
axios.defaults.timeout = 30000; // 30 second timeout
axios.defaults.maxContentLength = 50 * 1024 * 1024; // 50MB
axios.defaults.maxBodyLength = 50 * 1024 * 1024; // 50MB
const BASE_URL = process.env.REACT_APP_BASE_URL || "https://emis.dhis2nigeria.org.ng/dhis/api";
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `ApiToken ${process.env.REACT_APP_API_TOKEN}`,
};

// Sample user data for download
const SAMPLE_USERS = [
  {
    firstName: "PVT",
    surname: "Royal",
    username: 12020407,
    password: "Egor123@",
    userRoles: [{ id: "KBkjSGFKSKI" }, { id: "oO6BBApzmHZ" }],
    organisationUnits: [{ id: "wRQIw3NMW29" }],
    dataViewOrganisationUnits: [{ id: "wRQIw3NMW29" }],
    teiSearchOrganisationUnits: [{ id: "wRQIw3NMW29" }],
    userGroups: [{ id: "U8WuGyxfFFp" }],
  },
  {
    firstName: "PVT",
    surname: "Dominion",
    username: 12020409,
    password: "Egor123@",
    userRoles: [{ id: "KBkjSGFKSKI" }, { id: "oO6BBApzmHZ" }],
    organisationUnits: [{ id: "AVEyJypVCjJ" }],
    dataViewOrganisationUnits: [{ id: "AVEyJypVCjJ" }],
    teiSearchOrganisationUnits: [{ id: "AVEyJypVCjJ" }],
    userGroups: [{ id: "U8WuGyxfFFp" }],
  },
];

function App() {
  // State declarations
  const [users, setUsers] = useState([]);
  const [failedUsers, setFailedUsers] = useState([]);
  const [log, setLog] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUsers, setExportedUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]); // For deletion
  const [importStats, setImportStats] = useState({ success: 0, failed: 0 }); // For dashboard
  const [usernameFilter, setUsernameFilter] = useState('');
  const [orgUnitFilter, setOrgUnitFilter] = useState('');
  const [theme, setTheme] = useState('dark');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('import');
  const [batchSize, setBatchSize] = useState(2);
  const [connectionStatus, setConnectionStatus] = useState('checking...');
  const [selectedColumns, setSelectedColumns] = useState([
    'id', 'name', 'username', 'userGroups', 'userRoles', 'lastLogin', 'OrgunitPath',
  ]);
  const [showHelp, setShowHelp] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const shouldStop = useRef(false);
  const logEndRef = useRef(null);
  const prevStatus = useRef('checking...'); // For connection status changes

  const usersPerPage = 100;
  const availableColumns = [
    { id: 'id', label: 'ID' },
    { id: 'name', label: 'Name' },
    { id: 'username', label: 'Username' },
    { id: 'userGroups', label: 'Groups' },
    { id: 'userRoles', label: 'Roles' },
    { id: 'lastLogin', label: 'Last Login' },
    { id: 'OrgunitPath', label: 'Orgunit Path' },
    { id: 'OrgunitUID', label: 'Orgunit UID' },
  ];

  // Append log with size limit
  const appendLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prevLog => {
      const newLog = [...prevLog, { message, type, timestamp }];
      return newLog.slice(-100); // Keep last 100 entries
    });
  };

  // Enhanced API request with retries
  const apiRequest = useCallback(async (config, attempt = 1) => {
    const maxRetries = 3;
    const baseDelay = 1000;
    
    try {
      const response = await axios({
        ...config,
        timeout: 30000,
        headers: { ...HEADERS, ...config.headers },
      });
      return response;
    } catch (error) {
      if (attempt >= maxRetries) throw error;
      
      const retryDelay = baseDelay * Math.pow(2, attempt - 1);
      appendLog(`⚠️ Attempt ${attempt} failed, retrying in ${retryDelay/1000}s...`, 'warning');
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return apiRequest(config, attempt + 1);
    }
  }, [appendLog]);

  // Connection monitoring with retry and status change notifications
  useEffect(() => {
    let retries = 0;
    const maxRetries = 3;
    
    const checkConnection = async () => {
      try {
        await apiRequest({ method: 'get', url: `${BASE_URL}/system/ping` });
        if (connectionStatus !== 'connected') {
          setConnectionStatus('connected');
          appendLog('🔌 Server connected', 'success');
        }
        retries = 0;
      } catch {
        retries++;
        if (retries >= maxRetries && connectionStatus !== 'disconnected') {
          setConnectionStatus('disconnected');
          appendLog('⚠️ Failed to connect to server after retries', 'error');
        } else {
          setTimeout(checkConnection, 1000 * Math.pow(2, retries));
        }
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [apiRequest, connectionStatus]);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Keyboard shortcut for import
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'i' && !processing && users.length > 0 && connectionStatus === 'connected') {
        confirmImport();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processing, users.length, connectionStatus]);

  // File upload handler with drag-and-drop
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadstart = () => appendLog('⏳ Loading user file...', 'info');
    reader.onload = event => {
      try {
        if (file.name.endsWith('.csv')) {
          const convertedUsers = convertCSVtoJSON(event.target.result);
          if (convertedUsers) {
            setUsers(convertedUsers);
            appendLog(`✅ Loaded and converted ${convertedUsers.length} users from CSV`, 'success');
          }
        } else {
          const data = JSON.parse(event.target.result);
          if (!Array.isArray(data)) throw new Error('File should contain an array of users');
          setUsers(data);
          appendLog(`✅ Loaded ${data.length} users from JSON`, 'success');
        }
      } catch (error) {
        appendLog(`❌ Error parsing file: ${error.message}`, 'error');
      }
    };
    reader.onerror = () => appendLog('❌ Failed to read file', 'error');
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-dashed', 'border-primary');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('border-dashed', 'border-primary');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-dashed', 'border-primary');
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadstart = () => appendLog('⏳ Loading user file...', 'info');
      reader.onload = event => {
        try {
          if (file.name.endsWith('.csv')) {
            const convertedUsers = convertCSVtoJSON(event.target.result);
            if (convertedUsers) {
              setUsers(convertedUsers);
              appendLog(`✅ Loaded and converted ${convertedUsers.length} users from CSV`, 'success');
            }
          } else {
            const data = JSON.parse(event.target.result);
            if (!Array.isArray(data)) throw new Error('File should contain an array of users');
            setUsers(data);
            appendLog(`✅ Loaded ${data.length} users from JSON`, 'success');
          }
        } catch (error) {
          appendLog(`❌ Error parsing file: ${error.message}`, 'error');
        }
      };
      reader.onerror = () => appendLog('❌ Failed to read file', 'error');
      reader.readAsText(file);
    }
  };

  // Reusable download function
  const downloadFile = (content, filename, mimeType) => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      appendLog(`✅ Downloaded ${filename}`, 'success');
    } catch (error) {
      appendLog(`❌ Download failed: ${error.message}`, 'error');
    }
  };

  // Sample JSON download
  const downloadSampleJson = () => {
    downloadFile(JSON.stringify(SAMPLE_USERS, null, 2), 'dhis2_users_sample.json', 'application/json');
  };

  // Sample CSV download
  const downloadSampleCSV = () => {
    const headers = [
      'firstName',
      'surname',
      'username',
      'password',
      'userRoles',
      'organisationUnits',
      'dataViewOrganisationUnits',
      'teiSearchOrganisationUnits',
      'userGroups',
    ].join(',');

    const sampleRow = [
      'JSS',
      'Com',
      '11010051',
      'Abakaliki123@',
      '[{"id": "KBkjSGFKSKI"},{"id": "oO6BBApzmHZ"}]',
      '[{"id": "wMcSLrAHchs"}]',
      '[{"id": "wMcSLrAHchs"}]',
      '[{"id": "wMcSLrAHchs"}]',
      '[{"id": "Ca67o1mgiPn"}]',
    ].map(field => `"${field}"`).join(',');

    const csvContent = [headers, sampleRow].join('\n');
    downloadFile(csvContent, 'dhis2_users_template.csv', 'text/csv;charset=utf-8;');
  };

  // Export failed users
  const exportFailedUsers = () => {
    if (failedUsers.length === 0) {
      appendLog('⚠️ No failed users to export', 'warning');
      return;
    }
    const content = JSON.stringify(failedUsers, null, 2);
    downloadFile(content, `failed_users_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
  };

  // Clear failed users list
  const clearFailedUsers = () => {
    if (failedUsers.length === 0) {
      appendLog('⚠️ No failed users to clear', 'warning');
      return;
    }
    if (window.confirm(`Are you sure you want to clear ${failedUsers.length} failed users?`)) {
      setFailedUsers([]);
      appendLog('🧹 Cleared failed users list', 'success');
    }
  };

  // User validation
  const validateUser = (user) => {
    if (!user.username) return 'Username is required';
    if (!user.userRoles?.length) return 'At least one user role is required';
    if (!user.organisationUnits?.length) return 'At least one organization unit is required';
    return null;
  };

  // User management functions
  const getUserId = async (username) => {
    try {
      const res = await apiRequest({
        method: 'get',
        url: `${BASE_URL}/users?filter=username:eq:${username}&fields=id`,
      });
      return res.data.users?.[0]?.id || null;
    } catch (error) {
      appendLog(`⚠️ Error fetching user ID for ${username}: ${error.message}`, 'warning');
      return null;
    }
  };

  const updateUser = async (user, id) => {
    try {
      const payload = {
        firstName: user.firstName,
        surname: user.surname,
        username: user.username,
        userRoles: user.userRoles.map(role => ({ id: role.id })),
        organisationUnits: user.organisationUnits.map(ou => ({ id: ou.id })),
        dataViewOrganisationUnits: user.dataViewOrganisationUnits.map(ou => ({ id: ou.id })),
        teiSearchOrganisationUnits: user.teiSearchOrganisationUnits.map(ou => ({ id: ou.id })),
        userGroups: user.userGroups.map(group => ({ id: group.id })),
      };

      await apiRequest({
        method: 'put',
        url: `${BASE_URL}/users/${id}`,
        data: payload,
      });
      
      appendLog(`🔄 Updated user: ${user.username}`, 'success');
      return true;
    } catch (error) {
      appendLog(`❌ Error updating user ${user.username}: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  };

  const createUser = async (user) => {
    try {
      await apiRequest({
        method: 'post',
        url: `${BASE_URL}/users`,
        data: user,
      });
      appendLog(`🆕 Created user: ${user.username}`, 'success');
      return true;
    } catch (error) {
      if (error.response?.status === 409) {
        const id = await getUserId(user.username);
        if (id) {
          appendLog(`⚠️ Conflict: Updating user ${user.username}`, 'warning');
          return await updateUser(user, id);
        } else {
          appendLog(`❌ Conflict and ID not found: ${user.username}`, 'error');
          return false;
        }
      }
      appendLog(`❌ Error for ${user.username}: ${error.message}`, 'error');
      return false;
    }
  };

  const deleteUser = async (userId, username) => {
    try {
      // Clear dependencies to avoid E4055
      await apiRequest({
        method: 'put',
        url: `${BASE_URL}/users/${userId}`,
        data: {
          userRoles: [{ id: 'oO6BBApzmHZ' }], // Minimal role
          organisationUnits: [],
          dataViewOrganisationUnits: [],
          teiSearchOrganisationUnits: [],
          userGroups: [],
        },
      });
      // Delete user
      await apiRequest({
        method: 'delete',
        url: `${BASE_URL}/users/${userId}`,
      });
      appendLog(`🗑️ Deleted user: ${username}`, 'success');
      return true;
    } catch (error) {
      appendLog(`❌ Failed to delete ${username}: ${error.message}`, 'error');
      return false;
    }
  };

  const deleteSelectedUsers = async () => {
    if (selectedUsers.length === 0) {
      appendLog('⚠️ No users selected for deletion', 'warning');
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedUsers.length} users?`)) {
      setProcessing(true);
      let successCount = 0;
      for (const user of selectedUsers) {
        const success = await deleteUser(user.id, user.username);
        if (success) successCount++;
      }
      setExportedUsers(prev => prev.filter(u => !selectedUsers.some(su => su.id === u.id)));
      setSelectedUsers([]);
      appendLog(`🎉 Deletion completed. Success: ${successCount}, Failed: ${selectedUsers.length - successCount}`, 'success');
      setProcessing(false);
    }
  };

  // Process batch with parallel execution
  const processBatch = async (batch) => {
    const promises = batch.map(async (user, index) => {
      try {
        const id = await getUserId(user.username);
        const success = id ? await updateUser(user, id) : await createUser(user);
        return { user, success };
      } catch (error) {
        appendLog(`❌ Failed to process ${user.username}: ${error.message}`, 'error');
        return { user, success: false };
      }
    });
    return Promise.all(promises);
  };

  // Process users with validation
  const confirmImport = () => {
    if (window.confirm(`Are you sure you want to import ${users.length} users?`)) {
      processUsers();
    }
  };

  const retryFailedImports = () => {
    if (failedUsers.length === 0) {
      appendLog('⚠️ No failed users to retry', 'warning');
      return;
    }
    if (window.confirm(`Are you sure you want to retry importing ${failedUsers.length} failed users?`)) {
      processUsers(failedUsers);
    }
  };

  const processUsers = async (retryUsers = users) => {
    const invalidUsers = retryUsers.filter(user => validateUser(user));
    if (invalidUsers.length) {
      appendLog(`⚠️ Invalid users detected: ${invalidUsers.length}`, 'warning');
      return;
    }

    setProcessing(true);
    shouldStop.current = false;
    setProgress(0);
    setFailedUsers([]);
    
    let successCount = 0;
    let errorCount = 0;
    const failed = [];
    const totalBatches = Math.ceil(retryUsers.length / batchSize);

    appendLog(`🚀 Starting import of ${retryUsers.length} users (${totalBatches} batches)`, 'info');
    
    for (let i = 0; i < retryUsers.length && !shouldStop.current; i += batchSize) {
      const batch = retryUsers.slice(i, i + batchSize);
      appendLog(`🔨 Processing batch ${Math.floor(i/batchSize) + 1}/${totalBatches}`, 'info');
      
      const batchResults = await processBatch(batch);
      batchResults.forEach(({ user, success }, index) => {
        if (success) {
          successCount++;
        } else {
          errorCount++;
          failed.push(batch[index]);
        }
      });
      
      setProgress(Math.round(((i + batchSize) / retryUsers.length) * 100));
      
      if (shouldStop.current) break;
    }
    
    setFailedUsers(failed);
    setImportStats({ success: successCount, failed: errorCount });
    appendLog(
      `🎉 Process ${shouldStop.current ? 'stopped' : 'completed'}. Success: ${successCount}, Errors: ${errorCount}`,
      errorCount > 0 ? 'warning' : 'success'
    );
    
    setProcessing(false);
  };

  const stopProcessing = () => {
    shouldStop.current = true;
    appendLog("⏹ Stopping process after current batch completes...", 'warning');
  };

  // Export functions
  const exportUsersToCSV = async () => {
    appendLog("📦 Starting DHIS2 user export...", 'info');
    setProcessing(true);
    setExportProgress(0);

    try {
      let seenIds = new Set();
      let usersList = [];
      let nextUrl = `${BASE_URL}/users.json?fields=id,name,username,userGroups[name],userRoles[name],lastLogin,organisationUnits[ancestors[name],name,id]&paging=true&pageSize=10000`;
      let pageCount = 0;

      while (nextUrl) {
        const response = await apiRequest({ method: 'get', url: nextUrl });
        if (response.status !== 200) break;

        const data = response.data;
        const users = data.users || [];
        const pager = data.pager || {};

        pageCount++;
        const totalPages = pager.totalPages || 1;
        const currentProgress = Math.min((pageCount / totalPages) * 100, 100);
        setExportProgress(currentProgress);

        for (const user of users) {
          const uid = user.id;
          if (!uid || seenIds.has(uid)) continue;
          seenIds.add(uid);

          const userGroups = user.userGroups?.map(g => g.name).join("; ") || "";
          const userRoles = user.userRoles?.map(r => r.name).join("; ") || "";
          const lastLogin = user.lastLogin || "";

          let OrgunitPaths = [];
          let OrgunitUIDs = [];

          (user.organisationUnits || []).forEach(ou => {
            if (ou.ancestors?.length === 4) {
              const path = [...ou.ancestors.map(a => a.name), ou.name].join(" > ");
              OrgunitPaths.push(path);
              OrgunitUIDs.push(ou.id || "");
            }
          });

          usersList.push({
            id: uid,
            name: user.name || '',
            username: user.username || '',
            userGroups,
            userRoles,
            lastLogin,
            OrgunitPath: OrgunitPaths.join(" | "),
            OrgunitUID: OrgunitUIDs.join(" | "),
          });
        }

        appendLog(`✅ Page ${pager.page} fetched. Total: ${seenIds.size}`, 'success');
        nextUrl = pager.nextPage || null;
      }

      setExportedUsers(usersList);
      appendLog(`🎉 Export complete. Total users: ${seenIds.size}`, 'success');
    } catch (error) {
      appendLog(`❌ Export failed: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
      setExportProgress(0);
    }
  };

  const exportFilteredUsers = (format = 'csv') => {
    const filtered = filteredUsers;
    if (filtered.length === 0) {
      appendLog('⚠️ No users match your filters', 'warning');
      return;
    }

    try {
      let content, mimeType, extension;
      
      if (format === 'csv') {
        const headers = availableColumns
          .filter(col => selectedColumns.includes(col.id))
          .map(col => col.label);
        
        const rows = filtered.map(user => 
          selectedColumns.map(col => {
            const value = user[col] || '';
            return value.includes(',') ? `"${value}"` : value;
          }).join(',')
        );
        
        content = [headers.join(','), ...rows].join('\n');
        mimeType = 'text/csv;charset=utf-8;';
        extension = 'csv';
      } else {
        content = JSON.stringify(filtered, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      }

      downloadFile(content, `dhis2_users_${new Date().toISOString().slice(0,10)}.${extension}`, mimeType);
    } catch (error) {
      appendLog(`❌ Export error: ${error.message}`, 'error');
    }
  };

  // UI helpers
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const filteredUsers = useMemo(() => {
    return exportedUsers.filter(user =>
      user.username.toLowerCase().includes(usernameFilter.toLowerCase()) &&
      user.OrgunitPath.toLowerCase().includes(orgUnitFilter.toLowerCase())
    );
  }, [exportedUsers, usernameFilter, orgUnitFilter]);

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const handleNextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const handlePrevPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);

  const toggleColumn = (columnId) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) ? prev.filter(id => id !== columnId) : [...prev, columnId]
    );
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => 
      prev.some(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const selectAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers);
    }
  };

  const sortTable = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sortedUsers = [...exportedUsers].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setExportedUsers(sortedUsers);
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'error': return 'text-error';
      case 'warning': return 'text-warning';
      case 'success': return 'text-success';
      default: return 'text-gray-300';
    }
  };
  // Add this function near other utility functions (e.g., after `getLogColor`)
const clearLogs = () => {
  if (window.confirm('Are you sure you want to clear all activity logs?')) {
    setLog([]);
    appendLog('🧹 Cleared activity logs', 'success');
  }
};
  const rowHeight = 60;
  const listHeight = 400;

  const renderRow = ({ index, key, style }) => {
    const user = currentUsers[index];
    return (
      <div key={key} style={style} className={`flex items-center border-b ${
        index % 2 === 0
          ? theme === 'dark'
            ? 'bg-dark-card'
            : 'bg-light-card'
          : theme === 'dark'
            ? 'bg-gray-800'
            : 'bg-gray-50'
      }`}>
        <div className="p-3 sm:p-4 border-r text-sm sm:text-base">
          <input
            type="checkbox"
            checked={selectedUsers.some(u => u.id === user.id)}
            onChange={() => toggleUserSelection(user)}
            className="rounded"
            aria-label={`Select user ${user.username}`}
          />
        </div>
        {selectedColumns.map(col => (
          <div
            key={col}
            className="p-3 sm:p-4 border-r text-sm sm:text-base break-words"
            style={{
              minWidth: col === 'OrgunitPath' || col === 'OrgunitUID' ? '200px' : '100px',
              display: 'table-cell',
            }}
          >
            {user[col]}
          </div>
        ))}
      </div>
    );
  };

  // Chart data for import stats
  const chartData = {
    labels: ['Successful Imports', 'Failed Imports'],
    datasets: [{
      data: [importStats.success, importStats.failed],
      backgroundColor: ['#34D399', '#EF4444'],
      borderColor: ['#34D399', '#EF4444'],
      borderWidth: 1,
    }],
  };

  return (
    <div className={`min-h-screen p-4 ${theme === 'dark' ? 'bg-dark-bg text-dark-text' : 'bg-light-bg text-light-text'}`}>
      <div className="max-w-7xl mx-auto rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className={`p-6 ${theme === 'dark' ? 'bg-dark-card' : 'bg-primary'} text-white`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FiUsers className="text-2xl" />
              <h1 className="text-2xl font-bold">DHIS2 User Manager</h1>
            </div>
            <div className="flex space-x-4">
              <button 
                onClick={toggleTheme} 
                className="flex items-center space-x-1 bg-black bg-opacity-20 px-3 py-1 rounded hover:bg-opacity-30 transition-all duration-200 transform hover:scale-105"
                data-tooltip-id="theme-tooltip"
                data-tooltip-content={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <FiMoon /> : <FiSun />}
                <span>{theme === 'light' ? 'Dark' : 'Light'} Mode</span>
              </button>
              <Tooltip id="theme-tooltip" />
              <button 
                onClick={() => setShowHelp(true)}
                className="flex items-center space-x-1 bg-black bg-opacity-20 px-3 py-1 rounded hover:bg-opacity-30 transition-all duration-200 transform hover:scale-105"
                data-tooltip-id="help-tooltip"
                data-tooltip-content="Open help documentation"
                aria-label="Open help"
              >
                <FiHelpCircle />
                <span>Help</span>
              </button>
              <Tooltip id="help-tooltip" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`p-6 ${theme === 'dark' ? 'bg-dark-card' : 'bg-light-card'}`}>
          {/* Connection Status */}
          <div className="mb-4 p-2 rounded-md bg-blue-50 border border-blue-200 dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center">
              <span className="font-medium mr-2">Server Status:</span>
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                connectionStatus === 'connected' ? 'bg-success animate-pulse' : 'bg-error'
              }`}></span>
              <span>{connectionStatus}</span>
            </div>
            {connectionStatus === 'disconnected' && (
              <p className="mt-1 text-sm text-error">
                Connection issues detected. Some operations may fail.
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b mb-6">
            <button
              className={`px-6 py-3 font-semibold flex items-center text-lg ${
                activeTab === 'import' 
                  ? theme === 'dark' 
                    ? 'text-blue-300 border-b-4 border-blue-300' 
                    : 'text-primary border-b-4 border-primary' 
                  : theme === 'dark' 
                    ? 'text-dark-text' 
                    : 'text-light-text'
              }`}
              onClick={() => setActiveTab('import')}
              data-tooltip-id="import-tooltip"
              data-tooltip-content="Import users from JSON or CSV files"
              aria-selected={activeTab === 'import'}
            >
              <FiUpload className="mr-2" />
              Import Users
            </button>
            <Tooltip id="import-tooltip" />
            <button
              className={`px-6 py-3 font-semibold flex items-center text-lg ${
                activeTab === 'export' 
                  ? theme === 'dark' 
                    ? 'text-blue-300 border-b-4 border-blue-300' 
                    : 'text-primary border-b-4 border-primary' 
                  : theme === 'dark' 
                    ? 'text-dark-text' 
                    : 'text-light-text'
              }`}
              onClick={() => setActiveTab('export')}
              data-tooltip-id="export-tooltip"
              data-tooltip-content="Export or delete users from DHIS2 server"
              aria-selected={activeTab === 'export'}
            >
              <FiDownload className="mr-2" />
              Export/Delete Users
            </button>
            <Tooltip id="export-tooltip" />
          </div>

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <h2 className="text-lg font-semibold mb-3">Import Users</h2>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[300px]">
                    <label className="block mb-2 font-medium" htmlFor="file-upload">Upload File</label>
                    <div
                      id="file-upload-desc"
                      className="text-sm text-gray-500 dark:text-gray-400 mb-1"
                    >
                      Upload a JSON or CSV file containing user data.
                    </div>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`flex-1 border rounded-lg p-4 cursor-pointer flex items-center ${
                        theme === 'dark' ? 'border-gray-600 bg-gray-900 hover:bg-gray-800' : 'border-gray-300 bg-white hover:bg-gray-50'
                      } transition-all duration-200`}
                    >
                      <FiUpload className="mr-2" />
                      <span>{fileName || 'Choose File or Drag & Drop'}</span>
                      <input 
                        id="file-upload"
                        type="file" 
                        accept=".json,.csv" 
                        onChange={handleFileUpload} 
                        disabled={processing}
                        className="hidden" 
                        aria-label="Upload JSON or CSV file"
                        aria-describedby="file-upload-desc"
                      />
                    </div>
                    {users.length > 0 && (
                      <p className="mt-2 text-sm text-success">
                        ✅ {users.length} users loaded
                      </p>
                    )}
                  </div>

                  <div className="flex-1 min-w-[300px]">
                    <label className="block mb-2 font-medium" htmlFor="batch-size">Batch Settings</label>
                    <select
                      id="batch-size"
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      className={`w-full border rounded-lg p-2 ${
                        theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                      aria-label="Select batch size for user import"
                    >
                      {[1, 2, 5, 10].map(size => (
                        <option key={size} value={size}>{size} users/batch</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex space-x-2">
                  <button 
                    onClick={() => {
                      if (users.length > 0) {
                        downloadFile(JSON.stringify(users, null, 2), 'converted_users.json', 'application/json');
                      } else {
                        appendLog('⚠️ No users loaded to convert', 'warning');
                      }
                    }}
                    className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                      theme === 'dark' ? 'bg-purple-700 hover:bg-purple-600' : 'bg-purple-600 hover:bg-purple-500'
                    } text-white`}
                    data-tooltip-id="convert-tooltip"
                    data-tooltip-content="Convert loaded users to JSON"
                    aria-label="Convert loaded users to JSON"
                  >
                    <FiDownload className="mr-2" />
                    Convert to JSON
                  </button>
                  <Tooltip id="convert-tooltip" />
                  <button 
                    onClick={downloadSampleJson}
                    className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                      theme === 'dark' ? 'bg-purple-700 hover:bg-purple-600' : 'bg-purple-600 hover:bg-purple-500'
                    } text-white`}
                    data-tooltip-id="json-sample-tooltip"
                    data-tooltip-content="Download JSON sample"
                    aria-label="Download JSON sample"
                  >
                    <FiDownload className="mr-2" />
                    JSON
                  </button>
                  <Tooltip id="json-sample-tooltip" />
                  <button 
                    onClick={downloadSampleCSV}
                    className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                      theme === 'dark' ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-500'
                    } text-white`}
                    data-tooltip-id="csv-template-tooltip"
                    data-tooltip-content="Download CSV template"
                    aria-label="Download CSV template"
                  >
                    <FiDownload className="mr-2" />
                    CSV
                  </button>
                  <Tooltip id="csv-template-tooltip" />
                </div>
              </div>

              {/* Preview Uploaded Users */}
              {users.length > 0 && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <h3 className="font-medium mb-3">Uploaded Users Preview ({users.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="table-auto min-w-full border border-gray-400 dark:border-gray-600">
                      <thead className={`${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-300'}`}>
                        <tr>
                          <th className="p-3 border">Username</th>
                          <th className="p-3 border">First Name</th>
                          <th className="p-3 border">Surname</th>
                          <th className="p-3 border">User Roles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.slice(0, 10).map((user, index) => (
                          <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} dark:bg-gray-800`}>
                            <td className="p-3 border">{user.username}</td>
                            <td className="p-3 border">{user.firstName}</td>
                            <td className="p-3 border">{user.surname}</td>
                            <td className="p-3 border">{user.userRoles?.map(r => r.id).join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {users.length > 10 && (
                    <p className="mt-2 text-sm text-gray-500">Showing first 10 users. Total: {users.length}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={confirmImport} 
                  disabled={processing || users.length === 0 || connectionStatus !== 'connected'}
                  className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                    processing || users.length === 0 || connectionStatus !== 'connected'
                      ? 'bg-secondary cursor-not-allowed opacity-50'
                      : 'bg-primary hover:bg-primary/90 text-white'
                  }`}
                  data-tooltip-id="start-import-tooltip"
                  data-tooltip-content="Start importing users"
                  aria-label="Start user import"
                >
                  <FiPlay className="mr-2" />
                  Start Import
                </button>
                <Tooltip id="start-import-tooltip" />
                <button 
                  onClick={stopProcessing} 
                  disabled={!processing}
                  className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                    !processing 
                      ? 'bg-secondary cursor-not-allowed opacity-50'
                      : 'bg-error hover:bg-error/90 text-white'
                  }`}
                  data-tooltip-id="stop-import-tooltip"
                  data-tooltip-content="Stop user import"
                  aria-label="Stop user import"
                >
                  <FiSquare className="mr-2" />
                  Stop
                </button>
                <Tooltip id="stop-import-tooltip" />
                <button 
                  onClick={retryFailedImports}
                  disabled={processing || failedUsers.length === 0 || connectionStatus !== 'connected'}
                  className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                    processing || failedUsers.length === 0 || connectionStatus !== 'connected'
                      ? 'bg-secondary cursor-not-allowed opacity-50'
                      : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                  }`}
                  data-tooltip-id="retry-import-tooltip"
                  data-tooltip-content="Retry failed user imports"
                  aria-label="Retry failed user imports"
                >
                  <FiPlay className="mr-2" />
                  Retry Failed ({failedUsers.length})
                </button>
                <Tooltip id="retry-import-tooltip" />
                <button 
                  onClick={exportFailedUsers}
                  disabled={failedUsers.length === 0}
                  className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                    failedUsers.length === 0
                      ? 'bg-secondary cursor-not-allowed opacity-50'
                      : 'bg-orange-600 hover:bg-orange-500 text-white'
                  }`}
                  data-tooltip-id="export-failed-tooltip"
                  data-tooltip-content="Export failed users to JSON"
                  aria-label="Export failed users"
                >
                  <FiDownload className="mr-2" />
                  Export Failed ({failedUsers.length})
                </button>
                <Tooltip id="export-failed-tooltip" />
                <button 
                  onClick={clearFailedUsers}
                  disabled={failedUsers.length === 0}
                  className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                    failedUsers.length === 0
                      ? 'bg-secondary cursor-not-allowed opacity-50'
                      : 'bg-red-600 hover:bg-red-500 text-white'
                  }`}
                  data-tooltip-id="clear-failed-tooltip"
                  data-tooltip-content="Clear failed users list"
                  aria-label="Clear failed users"
                >
                  <FiSquare className="mr-2" />
                  Clear Failed ({failedUsers.length})
                </button>
                <Tooltip id="clear-failed-tooltip" />
              </div>

              {processing && (
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden dark:bg-gray-700 relative">
                  <div 
                    className="bg-primary h-4 transition-all duration-300 dark:bg-blue-400" 
                    style={{ width: `${progress}%` }} 
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                    {progress}%
                  </span>
                </div>
              )}

              {/* Import Statistics Dashboard */}
              {(importStats.success > 0 || importStats.failed > 0) && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <h3 className="font-medium mb-3">Import Statistics</h3>
                  <div className="w-full max-w-md mx-auto h-64 flex items-center justify-center">
                    <Pie
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'top' },
                          title: { display: true, text: 'Import Results' },
                        },
                      }}
                      style={{ maxHeight: '100%', maxWidth: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* Activity Log */}
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Activity Log</h3>
                <button 
                  onClick={clearLogs}
                  className={`px-3 py-1 rounded-lg flex items-center text-sm transition-all duration-200 transform hover:scale-105 ${
                    log.length === 0
                      ? 'bg-secondary cursor-not-allowed opacity-50'
                      : theme === 'dark' ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-500'
                  } text-white`}
                  data-tooltip-id="clear-logs-tooltip"
                  data-tooltip-content="Clear all activity logs"
                  aria-label="Clear activity logs"
                  disabled={log.length === 0}
                >
                  <FiSquare className="mr-1" />
                  Clear Logs
                </button>
              </div>
              <div 
                className={`h-60 overflow-y-auto p-3 rounded ${
                  theme === 'dark' ? 'bg-black' : 'bg-gray-200'
                }`} 
                role="log"
                aria-live="polite"
              >
                {log.length === 0 ? (
                  <p className={`text-center ${
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                  }`}>
                    No activity yet
                  </p>
                ) : (
                  <div className="font-mono text-sm space-y-2">
                    {log.map((entry, i) => (
                      <div
                        key={i}
                        className={`flex items-center ${getLogColor(entry.type)} border-l-4 pl-3 py-1 ${
                          entry.type === 'error' ? 'border-error' :
                          entry.type === 'warning' ? 'border-warning' :
                          entry.type === 'success' ? 'border-success' : 'border-secondary'
                        }`}
                      >
                        <span className="opacity-70 mr-2">[{entry.timestamp}]</span>
                        <span>
                          {entry.type === 'success' && '✅ '}
                          {entry.type === 'error' && '❌ '}
                          {entry.type === 'warning' && '⚠️ '}
                          {entry.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            </div>
            </div>
          )}

          {/* Export/Delete Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <h2 className="text-lg font-semibold mb-3">Export/Delete Users</h2>
                <button 
                  onClick={exportUsersToCSV} 
                  disabled={processing}
                  className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                    processing 
                      ? 'bg-secondary cursor-not-allowed opacity-50'
                      : 'bg-primary hover:bg-primary/90 text-white'
                  }`}
                  data-tooltip-id="fetch-users-tooltip"
                  data-tooltip-content="Fetch users from DHIS2"
                  aria-label="Fetch users from DHIS2"
                >
                  <FiDownload className="mr-2" />
                  Fetch Users from DHIS2
                </button>
                <Tooltip id="fetch-users-tooltip" />
              </div>

              {processing && activeTab === 'export' && (
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden dark:bg-gray-700 relative">
                  <div 
                    className="bg-primary h-4 transition-all duration-300 dark:bg-blue-400" 
                    style={{ width: `${exportProgress}%` }} 
                    role="progressbar"
                    aria-valuenow={exportProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                    {Math.round(exportProgress)}%
                  </span>
                </div>
              )}

              {exportedUsers.length > 0 && (
                <>
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <button
                      className="md:hidden mb-4 px-4 py-2 bg-primary text-white rounded-lg transition-all duration-200 transform hover:scale-105"
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      data-tooltip-id="toggle-filters-tooltip"
                      data-tooltip-content={isFilterOpen ? 'Hide filters' : 'Show filters'}
                      aria-label="Toggle filters"
                    >
                      {isFilterOpen ? 'Hide Filters' : 'Show Filters'}
                    </button>
                    <Tooltip id="toggle-filters-tooltip" />
                    <div className={`${isFilterOpen ? 'block' : 'hidden'} md:block`}>
                      <h3 className="font-medium mb-3">Filter & Export</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block mb-1" htmlFor="username-filter">Username</label>
                          <input
                            id="username-filter"
                            type="text"
                            placeholder="Filter by username"
                            value={usernameFilter}
                            onChange={(e) => setUsernameFilter(e.target.value)}
                            className={`w-full p-2 rounded border ${
                              theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-white border-gray-300'
                            }`}
                            aria-label="Filter users by username"
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            {filteredUsers.length} users match your filters
                          </p>
                        </div>
                        <div>
                          <label className="block mb-1" htmlFor="orgunit-filter">Organization Unit</label>
                          <input
                            id="orgunit-filter"
                            type="text"
                            placeholder="Filter by org unit path"
                            value={orgUnitFilter}
                            onChange={(e) => setOrgUnitFilter(e.target.value)}
                            className={`w-full p-2 rounded border ${
                              theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-white border-gray-300'
                            }`}
                            aria-label="Filter users by organization unit path"
                          />
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block mb-2">Columns to Export</label>
                        <div className="flex flex-wrap gap-2">
                          {availableColumns.map(col => (
                            <label key={col.id} className="flex items-center space-x-1">
                              <input
                                type="checkbox"
                                checked={selectedColumns.includes(col.id)}
                                onChange={() => toggleColumn(col.id)}
                                className="rounded"
                                aria-label={`Toggle ${col.label} column`}
                              />
                              <span>{col.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => {
                            setUsernameFilter('');
                            setOrgUnitFilter('');
                          }}
                          className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                            theme === 'dark' ? 'bg-secondary hover:bg-secondary/90' : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                          data-tooltip-id="clear-filters-tooltip"
                          data-tooltip-content="Clear all filters"
                          aria-label="Clear filters"
                        >
                          Clear Filters
                        </button>
                        <Tooltip id="clear-filters-tooltip" />
                        <button
                          onClick={() => exportFilteredUsers('csv')}
                          className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                            theme === 'dark' ? 'bg-success hover:bg-success/90' : 'bg-success hover:bg-success/90'
                          } text-white`}
                          data-tooltip-id="export-csv-tooltip"
                          data-tooltip-content="Export filtered users as CSV"
                          aria-label="Export filtered users as CSV"
                        >
                          <FiDownload className="mr-2" />
                          Export as CSV
                        </button>
                        <Tooltip id="export-csv-tooltip" />
                        <button
                          onClick={() => exportFilteredUsers('json')}
                          className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                            theme === 'dark' ? 'bg-yellow-700 hover:bg-yellow-600' : 'bg-yellow-600 hover:bg-yellow-500'
                          } text-white`}
                          data-tooltip-id="export-json-tooltip"
                          data-tooltip-content="Export filtered users as JSON"
                          aria-label="Export filtered users as JSON"
                        >
                          <FiDownload className="mr-2" />
                          Export as JSON
                        </button>
                        <Tooltip id="export-json-tooltip" />
                        <button
                          onClick={deleteSelectedUsers}
                          disabled={processing || selectedUsers.length === 0 || connectionStatus !== 'connected'}
                          className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 transform hover:scale-105 ${
                            processing || selectedUsers.length === 0 || connectionStatus !== 'connected'
                              ? 'bg-secondary cursor-not-allowed opacity-50'
                              : 'bg-red-600 hover:bg-red-500 text-white'
                          }`}
                          data-tooltip-id="delete-users-tooltip"
                          data-tooltip-content="Delete selected users"
                          aria-label="Delete selected users"
                        >
                          <FiTrash2 className="mr-2" />
                          Delete Selected ({selectedUsers.length})
                        </button>
                        <Tooltip id="delete-users-tooltip" />
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <h3 className="font-medium mb-3">User Data ({filteredUsers.length} users)</h3>
                    <button
                      onClick={selectAllUsers}
                      className={`mb-4 px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                        theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                      data-tooltip-id="select-all-tooltip"
                      data-tooltip-content={selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                      aria-label={selectedUsers.length === filteredUsers.length ? 'Deselect all users' : 'Select all users'}
                    >
                      {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <Tooltip id="select-all-tooltip" />
                    <div className="overflow-x-auto">
                      <table className="table-auto min-w-full border border-gray-400 dark:border-gray-600">
                        {/* Table Head */}
                        <thead className={`${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-300'}`}>
                          <tr>
                            <th className="p-3 border border-gray-400 dark:border-gray-600 text-left text-sm font-semibold">
                              <input
                                type="checkbox"
                                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                                onChange={selectAllUsers}
                                className="rounded"
                                aria-label="Select all users"
                              />
                            </th>
                            {selectedColumns.map(col => (
                              <th
                                key={col}
                                className="p-3 border border-gray-400 dark:border-gray-600 text-left text-sm font-semibold whitespace-normal break-words"
                                style={{
                                  minWidth: col === 'OrgunitPath' ? '400px' : '200px',
                                  maxWidth: col === 'OrgunitPath' ? '600px' : '300px',
                                }}
                                onClick={() => sortTable(col)}
                              >
                                {availableColumns.find(c => c.id === col)?.label}
                                {sortConfig.key === col && (
                                  <span>{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody>
                          {currentUsers.map((user, index) => (
                            <tr
                              key={index}
                              className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} dark:bg-gray-800`}
                            >
                              <td className="p-3 border border-gray-400 dark:border-gray-600 text-sm align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.some(u => u.id === user.id)}
                                  onChange={() => toggleUserSelection(user)}
                                  className="rounded"
                                  aria-label={`Select user ${user.username}`}
                                />
                              </td>
                              {selectedColumns.map(col => (
                                <td
                                  key={`${index}-${col}`}
                                  className="p-3 border border-gray-400 dark:border-gray-600 text-sm align-top whitespace-pre-wrap break-words"
                                  style={{
                                    minWidth: col === 'OrgunitPath' ? '400px' : '200px',
                                    maxWidth: col === 'OrgunitPath' ? '800px' : '300px',
                                  }}
                                >
                                  {String(user[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-4 flex justify-between items-center">
                        <button
                          onClick={handlePrevPage}
                          disabled={currentPage === 1}
                          className={`px-4 py-2 rounded ${
                            currentPage === 1
                              ? 'opacity-50 cursor-not-allowed'
                              : theme === 'dark'
                                ? 'bg-gray-600 hover:bg-gray-500'
                                : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                        >
                          Previous
                        </button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages}
                          className={`px-4 py-2 rounded ${
                            currentPage === totalPages
                              ? 'opacity-50 cursor-not-allowed'
                              : theme === 'dark'
                                ? 'bg-gray-600 hover:bg-gray-500'
                                : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Activity Log */}
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Activity Log</h3>
                  <button 
                    onClick={clearLogs}
                    className={`px-3 py-1 rounded-lg flex items-center text-sm transition-all duration-200 transform hover:scale-105 ${
                      log.length === 0
                        ? 'bg-secondary cursor-not-allowed opacity-50'
                        : theme === 'dark' ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-500'
                    } text-white`}
                    data-tooltip-id="clear-logs-tooltip"
                    data-tooltip-content="Clear all activity logs"
                    aria-label="Clear activity logs"
                    disabled={log.length === 0}
                  >
                    <FiSquare className="mr-1" />
                    Clear Logs
                  </button>
                </div>
                <div 
                  className={`h-60 overflow-y-auto p-3 rounded ${
                    theme === 'dark' ? 'bg-black' : 'bg-gray-200'
                  }`} 
                  role="log"
                  aria-live="polite"
                >
                  {log.length === 0 ? (
                    <p className={`text-center ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
                    }`}>
                      No activity yet
                    </p>
                  ) : (
                    <div className="font-mono text-sm space-y-2">
                      {log.map((entry, i) => (
                        <div
                          key={i}
                          className={`flex items-center ${getLogColor(entry.type)} border-l-4 pl-3 py-1 ${
                            entry.type === 'error' ? 'border-error' :
                            entry.type === 'warning' ? 'border-warning' :
                            entry.type === 'success' ? 'border-success' : 'border-secondary'
                          }`}
                        >
                          <span className="opacity-70 mr-2">[{entry.timestamp}]</span>
                          <span>
                            {entry.type === 'success' && '✅ '}
                            {entry.type === 'error' && '❌ '}
                            {entry.type === 'warning' && '⚠️ '}
                            {entry.message}
                          </span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Help Modal */}
          {showHelp && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" role="dialog" aria-labelledby="help-title">
              <div className={`p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                <h2 id="help-title" className="text-lg font-bold mb-4">Help</h2>
                <p className="mb-4">
                  The DHIS2 User Manager allows you to import, export, and delete user data in JSON or CSV formats.
                  Upload a file to import users, retry failed imports, or fetch and filter users from the DHIS2 server for export or deletion.
                  For more details, visit the <a href="https://docs.dhis2.org" className="text-blue-600 hover:underline">DHIS2 documentation</a>.
                </p>
                <button 
                  onClick={() => setShowHelp(false)}
                  className={`px-4 py-2 rounded transition-all duration-200 transform hover:scale-105 ${
                    theme === 'dark' ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-500'
                  } text-white`}
                  aria-label="Close help modal"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;