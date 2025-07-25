// DHIS2 User Manager App
// Author: Joseph Nongu
// (c) 2025 Joseph Nongu

import React, { useState, useRef, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import axios from 'axios';
import { FiUpload, FiDownload, FiPlay, FiSquare, FiSun, FiMoon, FiHelpCircle, FiUsers, FiTrash2, FiLock } from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import { List } from 'react-virtualized';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { convertCSVtoJSON } from './convertCSVtoJSON';

// Register Chart.js components
ChartJS.register(ArcElement, ChartTooltip, Legend);

// Theme Context
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return savedTheme || (systemPrefersDark ? 'dark' : 'light');
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => useContext(ThemeContext);

// Configure axios defaults
axios.defaults.timeout = 30000;
axios.defaults.maxContentLength = 50 * 1024 * 1024;
axios.defaults.maxBodyLength = 50 * 1024 * 1024;
const BASE_URL = process.env.REACT_APP_BASE_URL || "https://emis.dhis2nigeria.org.ng/dhis/api";
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `ApiToken ${process.env.REACT_APP_API_TOKEN}`,
};

// Sample user data
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

// Reusable Components
const ThemedButton = ({
  children,
  onClick,
  icon: Icon,
  variant = 'primary',
  className = '',
  disabled = false,
  ...props
}) => {
  const { theme } = useTheme();
  
  const variantClasses = {
    primary: theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700',
    secondary: theme === 'dark' ? 'bg-purple-700 hover:bg-purple-600' : 'bg-purple-600 hover:bg-purple-500',
    danger: theme === 'dark' ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-500',
    warning: theme === 'dark' ? 'bg-yellow-700 hover:bg-yellow-600' : 'bg-yellow-600 hover:bg-yellow-500',
    success: theme === 'dark' ? 'bg-green-700 hover:bg-green-600' : 'bg-green-600 hover:bg-green-500',
    disabled: 'bg-gray-400 cursor-not-allowed'
  };

  const currentVariant = disabled ? 'disabled' : variant;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg flex items-center transition-all duration-200 text-white ${variantClasses[currentVariant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="mr-2" />}
      {children}
    </button>
  );
};

const ThemedCard = ({ children, className = '', ...props }) => {
  const { theme } = useTheme();
  return (
    <div
      className={`rounded-lg shadow p-6 transition-colors duration-200 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

const ProgressBar = ({ progress }) => {
  const { theme } = useTheme();
  return (
    <div className={`w-full ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-4 overflow-hidden`}>
      <div 
        className={`${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-600'} h-4 rounded-full transition-all duration-300`}
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
};

// Main App Component
function App() {
  const { theme, toggleTheme } = useTheme();
  
  // State declarations
  const [users, setUsers] = useState([]);
  const [failedUsers, setFailedUsers] = useState([]);
  const [log, setLog] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUsers, setExportedUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [importStats, setImportStats] = useState({ success: 0, failed: 0 });
  const [usernameFilter, setUsernameFilter] = useState('');
  const [orgUnitFilter, setOrgUnitFilter] = useState('');
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
  const [passwordUsers, setPasswordUsers] = useState([]);
  const [processingPasswords, setProcessingPasswords] = useState(false);

  const shouldStop = useRef(false);
  const logEndRef = useRef(null);
  const prevStatus = useRef('checking...');

  const usersPerPage = 10;
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

  // Logging utility
  const appendLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prevLog => {
      const newLog = [...prevLog, { message, type, timestamp }];
      return newLog.slice(-100);
    });
  };

  // API request with retries
  const apiRequest = useCallback(async (config, attempt = 1) => {
    const maxRetries = 3;
    const baseDelay = 1000;

    try {
      const response = await axios({
        ...config,
        url: config.url.startsWith('http') ? config.url : `${BASE_URL}${config.url}`,
        timeout: 30000,
        headers: { ...HEADERS, ...config.headers },
      });
      return response;
    } catch (error) {
      if (attempt >= maxRetries) throw error;

      const retryDelay = baseDelay * Math.pow(2, attempt - 1);
      appendLog(`⚠️ Attempt ${attempt} failed, retrying in ${retryDelay / 1000}s...`, 'warning');
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return apiRequest(config, attempt + 1);
    }
  }, [appendLog]);

  // Connection monitoring
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

  // File processing
  const processFile = (file) => {
    if (!file) return;

    const validTypes = ['.json', '.csv'];
    const maxSize = 10 * 1024 * 1024;
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(extension)) {
      appendLog(`❌ Unsupported file type. Please upload a .json or .csv file.`, 'error');
      return;
    }
    if (file.size > maxSize) {
      appendLog(`❌ File size exceeds 10MB limit.`, 'error');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadstart = () => appendLog('⏳ Loading user file...', 'info');
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        let users;
        if (extension === '.csv') {
          users = convertCSVtoJSON(content);
          if (users) {
            setUsers(users);
            appendLog(`✅ Loaded and converted ${users.length} users from CSV`, 'success');
          }
        } else {
          users = JSON.parse(content);
          if (!Array.isArray(users)) throw new Error('File should contain an array of users');
          setUsers(users);
          appendLog(`✅ Loaded ${users.length} users from JSON`, 'success');
        }
      } catch (error) {
        appendLog(`❌ Error parsing file: ${error.message}`, 'error');
      }
    };
    reader.onerror = () => appendLog('❌ Failed to read file', 'error');
    reader.readAsText(file);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  // Drag-and-drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-dashed', 'border-blue-500');
    e.currentTarget.setAttribute('aria-busy', 'true');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-dashed', 'border-blue-500');
    e.currentTarget.removeAttribute('aria-busy');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-dashed', 'border-blue-500');
    e.currentTarget.removeAttribute('aria-busy');
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  // Download utilities
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

  const downloadSampleJson = () => {
    downloadFile(JSON.stringify(SAMPLE_USERS, null, 2), 'dhis2_users_sample.json', 'application/json');
  };

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

  const downloadSamplePasswordCsv = () => {
    const sampleData = `username,new_password,user_role_ids\n1090002,Obii123@333,"KBkjSGFKSKI,oO6BBApzmHZ"`;
    downloadFile(sampleData, 'Password_Update_Sample.csv', 'text/csv;charset=utf-8;');
  };

  const exportFailedUsers = () => {
    if (failedUsers.length === 0) {
      appendLog('⚠️ No failed users to export', 'warning');
      return;
    }
    const content = JSON.stringify(failedUsers, null, 2);
    downloadFile(content, `failed_users_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
  };

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
      const userResponse = await apiRequest({
        method: 'GET',
        url: `/users/${userId}`,
      });

      const user = userResponse.data;
      user.disabled = true;
      user.userRoles = [{ id: 'oO6BBApzmHZ' }];
      user.organisationUnits = [];
      user.dataViewOrganisationUnits = [];
      user.teiSearchOrganisationUnits = [];
      user.userGroups = [];

      await apiRequest({
        method: 'PUT',
        url: `/users/${userId}`,
        data: user,
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      await apiRequest({
        method: 'DELETE',
        url: `/users/${userId}`,
        timeout: 60000,
      });

      appendLog(`🗑️ Deleted user: ${username}`, 'success');
      return true;

    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED';

      if (isTimeout) {
        appendLog(`⌛ Timeout while deleting ${username}, checking if it was deleted...`, 'warning');

        try {
          await apiRequest({
            method: 'GET',
            url: `/users/${userId}`,
          });
          appendLog(`🔁 User '${username}' still exists after timeout`, 'warning');
          return false;
        } catch (verifyError) {
          if (verifyError.response?.status === 404) {
            appendLog(`✅ Confirmed: User '${username}' was deleted`, 'success');
            return true;
          }
        }
      }

      const message = error.response?.data?.message || error.message;
      appendLog(`❌ Failed to delete ${username}: ${message}`, 'error');
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

      setExportedUsers(prev =>
        prev.filter(u => !selectedUsers.some(su => su.id === u.id))
      );
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

  // Password update functions
  const handlePasswordCsvImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text.trim().split('\n').slice(1);
      const users = rows.map(row => {
        const [username, newPassword, userRoleIds] = row.split(',').map(s => s.trim());
        const roleObjects = userRoleIds.split(',').map(id => ({ id: id.trim() }));
        return { username, newPassword, userRoles: roleObjects };
      });
      setPasswordUsers(users);
      appendLog(`✅ Imported ${users.length} users for password update`, 'success');
    };
    reader.readAsText(file);
  };

  const processPasswordUpdates = async () => {
    if (passwordUsers.length === 0) {
      appendLog('⚠️ No users imported for password update', 'warning');
      return;
    }

    setProcessingPasswords(true);
    let successCount = 0;
    let errorCount = 0;

    appendLog(`🚀 Starting password update for ${passwordUsers.length} users`, 'info');

    for (let i = 0; i < passwordUsers.length; i++) {
      const { username, newPassword } = passwordUsers[i];

      try {
        const queryResponse = await apiRequest({
          method: 'GET',
          url: `/users?filter=username:eq:${username}&fields=id`,
        });

        const userList = queryResponse.data.users || [];
        if (userList.length === 0) {
          appendLog(`‼️ User '${username}' not found`, 'warning');
          errorCount++;
          continue;
        }

        const userId = userList[0].id;
        const userResponse = await apiRequest({
          method: 'GET',
          url: `/users/${userId}`,
        });

        const fullUserData = userResponse.data;
        if (!fullUserData.userCredentials) fullUserData.userCredentials = {};
        fullUserData.userCredentials.password = newPassword;

        const updateResponse = await apiRequest({
          method: 'PUT',
          url: `/users/${userId}`,
          data: fullUserData,
        });

        if ([200, 204].includes(updateResponse.status)) {
          appendLog(`✅ Password updated successfully for user '${username}'`, 'success');
          successCount++;
        } else {
          appendLog(`🚫 Failed to update user '${username}'. HTTP ${updateResponse.status}`, 'error');
          errorCount++;
        }
      } catch (error) {
        appendLog(`❌ Error updating '${username}': ${error.response?.data?.message || error.message}`, 'error');
        errorCount++;
      }

      setProgress(Math.round(((i + 1) / passwordUsers.length) * 100));
    }

    appendLog(`🎉 Password update completed. Success: ${successCount}, Errors: ${errorCount}`, errorCount > 0 ? 'warning' : 'success');
    setProcessingPasswords(false);
    setProgress(0);
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
      case 'error': return 'text-red-500 dark:text-red-400';
      case 'warning': return 'text-yellow-500 dark:text-yellow-400';
      case 'success': return 'text-green-500 dark:text-green-400';
      default: return 'text-gray-500 dark:text-gray-400';
    }
  };

  const clearLogs = () => {
    if (window.confirm('Are you sure you want to clear all activity logs?')) {
      setLog([]);
      appendLog('🧹 Cleared activity logs', 'success');
    }
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
    <div className={`min-h-screen bg-theme-${theme}-bg text-theme-${theme}-text font-sans transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg p-4 fixed top-0 left-0 right-0 z-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <FiUsers className="text-2xl text-white" />
              <h1 className="text-2xl font-bold">DHIS2 User Manager</h1>
            </div>
            <div className="flex space-x-4">
              <ThemedButton 
                onClick={toggleTheme}
                variant="secondary"
                data-tooltip-id="theme-tooltip"
                data-tooltip-content={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <FiMoon /> : <FiSun />}
                <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
              </ThemedButton>
              
              <ThemedButton 
                onClick={() => setShowHelp(true)}
                variant="secondary"
                data-tooltip-id="help-tooltip"
                data-tooltip-content="Open help documentation"
              >
                <FiHelpCircle />
                <span>Help</span>
              </ThemedButton>
            </div>
          </div>
        </header>

        {/* Main Content */}<br /><br />
        <main className="space-y-6">
          {/* Connection Status */}
          <ThemedCard className="mb-4">
            <div className="flex items-center">
              <span className="font-medium mr-2">Server Status:</span>
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></span>
              <span>{connectionStatus}</span>
            </div>
            {connectionStatus === 'disconnected' && (
              <p className={`mt-2 text-sm ${
                theme === 'dark' ? 'text-red-400' : 'text-red-500'
              }`}>
                Connection issues detected. Some operations may fail.
              </p>
            )}
          </ThemedCard>

          {/* Tabs */}
          <div className={`flex border-b ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <button
              className={`px-6 py-3 font-semibold flex items-center text-lg ${
                activeTab === 'import' 
                  ? theme === 'dark' 
                    ? 'text-blue-400 border-b-2 border-blue-400' 
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : theme === 'dark' 
                    ? 'text-gray-400 hover:text-gray-300' 
                    : 'text-gray-600 hover:text-gray-800'
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
                    ? 'text-blue-400 border-b-2 border-blue-400' 
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : theme === 'dark' 
                    ? 'text-gray-400 hover:text-gray-300' 
                    : 'text-gray-600 hover:text-gray-800'
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
            <button
              className={`px-6 py-3 font-semibold flex items-center text-lg ${
                activeTab === 'passwords' 
                  ? theme === 'dark' 
                    ? 'text-blue-400 border-b-2 border-blue-400' 
                    : 'text-blue-600 border-b-2 border-blue-600'
                  : theme === 'dark' 
                    ? 'text-gray-400 hover:text-gray-300' 
                    : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setActiveTab('passwords')}
              data-tooltip-id="passwords-tooltip"
              data-tooltip-content="Manage user passwords"
              aria-selected={activeTab === 'passwords'}
            >
              <FiLock className="mr-2" />
              Password Management
            </button>
            <Tooltip id="passwords-tooltip" />
          </div>

          {/* Import Tab */}
{activeTab === 'import' && (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <ThemedCard>
      <h2 className="text-xl font-semibold mb-4">Import Users</h2>
      <div className="space-y-4">
        <div>
          <label className="block mb-2 font-medium" htmlFor="file-upload">Upload File</label>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2" id="file-upload-desc">
            Upload a JSON or CSV file containing user data.
          </div>
          <label
            htmlFor="file-upload"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 rounded-lg p-6 text-center cursor-pointer block ${
              theme === 'dark' ? 'border-gray-700 bg-gray-900 hover:bg-gray-800' : 'border-gray-300 bg-white hover:bg-gray-50'
            } transition-all duration-200`}
          >
            <FiUpload className="mx-auto mb-2 text-2xl" />
            <span>{fileName || 'Choose File or Drag & Drop'}</span>
          </label>
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
          {users.length > 0 && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              ✅ {users.length} users loaded
            </p>
          )}
        </div>

        <div>
          <label className="block mb-2 font-medium" htmlFor="batch-size">Batch Settings</label>
          <select
            id="batch-size"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className={`w-full p-2 rounded border ${
              theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-white'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-label="Select batch size for user import"
          >
            {[1, 2, 5, 10].map(size => (
              <option key={size} value={size}>{size} users/batch</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          <ThemedButton 
            onClick={() => {
              if (users.length > 0) {
                downloadFile(JSON.stringify(users, null, 2), 'converted_users.json', 'application/json');
              } else {
                appendLog('⚠️ No users loaded to convert', 'warning');
              }
            }}
            variant="secondary"
            data-tooltip-id="convert-tooltip"
            data-tooltip-content="Convert loaded users to JSON"
          >
            <FiDownload className="mr-2" />
            Convert to JSON
          </ThemedButton>
          <Tooltip id="convert-tooltip" />
          <ThemedButton 
            onClick={downloadSampleJson}
            variant="secondary"
            data-tooltip-id="json-sample-tooltip"
            data-tooltip-content="Download JSON sample"
          >
            <FiDownload className="mr-2" />
            JSON
          </ThemedButton>
          <Tooltip id="json-sample-tooltip" />
          <ThemedButton 
            onClick={downloadSampleCSV}
            variant="primary"
            data-tooltip-id="csv-template-tooltip"
            data-tooltip-content="Download CSV template"
          >
            <FiDownload className="mr-2" />
            CSV
          </ThemedButton>
          <Tooltip id="csv-template-tooltip" />
        </div>
      </div>
    </ThemedCard>

    {/* Preview Uploaded Users */}
    {users.length > 0 && (
      <ThemedCard>
        <h3 className="text-lg font-semibold mb-4">Uploaded Users Preview ({users.length})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">Username</th>
                <th className="px-4 py-2 text-left text-sm font-medium">First Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium">Surname</th>
                <th className="px-4 py-2 text-left text-sm font-medium">User Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 10).map((user, index) => (
                <tr key={index} className={
                  index % 2 === 0 
                    ? theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    : theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                }>
                  <td className="px-4 py-2 text-sm">{user.username}</td>
                  <td className="px-4 py-2 text-sm">{user.firstName}</td>
                  <td className="px-4 py-2 text-sm">{user.surname}</td>
                  <td className="px-4 py-2 text-sm">{user.userRoles?.map(r => r.id).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length > 10 && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Showing first 10 users. Total: {users.length}</p>
        )}
      </ThemedCard>
    )}

    <ThemedCard className="col-span-2">
      <div className="flex flex-wrap gap-3">
        <ThemedButton 
          onClick={confirmImport} 
          disabled={processing || users.length === 0 || connectionStatus !== 'connected'}
          variant={processing || users.length === 0 || connectionStatus !== 'connected' ? 'disabled' : 'primary'}
          data-tooltip-id="start-import-tooltip"
          data-tooltip-content="Start importing users"
        >
          <FiPlay className="mr-2" />
          Start Import
        </ThemedButton>
        <Tooltip id="start-import-tooltip" />
        <ThemedButton 
          onClick={stopProcessing} 
          disabled={!processing}
          variant={!processing ? 'disabled' : 'danger'}
          data-tooltip-id="stop-import-tooltip"
          data-tooltip-content="Stop user import"
        >
          <FiSquare className="mr-2" />
          Stop
        </ThemedButton>
        <Tooltip id="stop-import-tooltip" />
        <ThemedButton 
          onClick={retryFailedImports}
          disabled={processing || failedUsers.length === 0 || connectionStatus !== 'connected'}
          variant={processing || failedUsers.length === 0 || connectionStatus !== 'connected' ? 'disabled' : 'warning'}
          data-tooltip-id="retry-import-tooltip"
          data-tooltip-content="Retry failed user imports"
        >
          <FiPlay className="mr-2" />
          Retry Failed ({failedUsers.length})
        </ThemedButton>
        <Tooltip id="retry-import-tooltip" />
        <ThemedButton 
          onClick={exportFailedUsers}
          disabled={failedUsers.length === 0}
          variant={failedUsers.length === 0 ? 'disabled' : 'warning'}
          data-tooltip-id="export-failed-tooltip"
          data-tooltip-content="Export failed users to JSON"
        >
          <FiDownload className="mr-2" />
          Export Failed ({failedUsers.length})
        </ThemedButton>
        <Tooltip id="export-failed-tooltip" />
        <ThemedButton 
          onClick={clearFailedUsers}
          disabled={failedUsers.length === 0}
          variant={failedUsers.length === 0 ? 'disabled' : 'danger'}
          data-tooltip-id="clear-failed-tooltip"
          data-tooltip-content="Clear failed users list"
        >
          <FiSquare className="mr-2" />
          Clear Failed ({failedUsers.length})
        </ThemedButton>
        <Tooltip id="clear-failed-tooltip" />
      </div>

      {processing && <ProgressBar progress={progress} />}

      {/* Import Statistics Dashboard */}
      {(importStats.success > 0 || importStats.failed > 0) && (
        <ThemedCard className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Import Statistics</h3>
          <div className="w-full max-w-md mx-auto h-64">
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
            />
          </div>
        </ThemedCard>
      )}

      {/* Activity Log */}
      <ThemedCard className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Activity Log</h3>
          <ThemedButton 
            onClick={clearLogs}
            variant={log.length === 0 ? 'disabled' : 'danger'}
            className="px-3 py-1"
          >
            <FiSquare className="mr-1" />
            Clear Logs
          </ThemedButton>
        </div>
        <div className={`h-60 overflow-y-auto p-3 rounded-lg ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
        }`}>
          {log.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">
              No activity yet
            </p>
          ) : (
            <div className="space-y-2">
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center ${getLogColor(entry.type)} border-l-4 pl-3 py-1 rounded`}
                >
                  <span className="text-xs opacity-70 mr-2">[{entry.timestamp}]</span>
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
      </ThemedCard>
    </ThemedCard>
  </div>
)}

          {/* Export/Delete Tab */}
          {activeTab === 'export' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ThemedCard>
                <h2 className="text-xl font-semibold mb-4">Export/Delete Users</h2>
                <ThemedButton 
                  onClick={exportUsersToCSV} 
                  disabled={processing}
                  variant={processing ? 'disabled' : 'primary'}
                  data-tooltip-id="fetch-users-tooltip"
                  data-tooltip-content="Fetch users from DHIS2"
                >
                  <FiDownload className="mr-2" />
                  Fetch Users from DHIS2
                </ThemedButton>
                <Tooltip id="fetch-users-tooltip" />
              </ThemedCard>

              {processing && activeTab === 'export' && <ProgressBar progress={exportProgress} />}

              {exportedUsers.length > 0 && (
                <>
                  <ThemedCard>
                    <button
                      className="md:hidden mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      data-tooltip-id="toggle-filters-tooltip"
                      data-tooltip-content={isFilterOpen ? 'Hide filters' : 'Show filters'}
                    >
                      {isFilterOpen ? 'Hide Filters' : 'Show Filters'}
                    </button>
                    <Tooltip id="toggle-filters-tooltip" />
                    <div className={`${isFilterOpen ? 'block' : 'hidden'} md:block`}>
                      <h3 className="text-lg font-semibold mb-4">Filter & Export</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block mb-2" htmlFor="username-filter">Username</label>
                          <input
                            id="username-filter"
                            type="text"
                            placeholder="Filter by username"
                            value={usernameFilter}
                            onChange={(e) => setUsernameFilter(e.target.value)}
                            className={`w-full p-2 rounded border ${
                              theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-white'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          />
                          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {filteredUsers.length} users match your filters
                          </p>
                        </div>
                        <div>
                          <label className="block mb-2" htmlFor="orgunit-filter">Organization Unit</label>
                          <input
                            id="orgunit-filter"
                            type="text"
                            placeholder="Filter by org unit path"
                            value={orgUnitFilter}
                            onChange={(e) => setOrgUnitFilter(e.target.value)}
                            className={`w-full p-2 rounded border ${
                              theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-white'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
                          className={`px-4 py-2 rounded-lg ${
                            theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                          } transition-all duration-200`}
                          data-tooltip-id="clear-filters-tooltip"
                          data-tooltip-content="Clear all filters"
                        >
                          Clear Filters
                        </button>
                        <Tooltip id="clear-filters-tooltip" />
                        <ThemedButton
                          onClick={() => exportFilteredUsers('csv')}
                          variant="success"
                          data-tooltip-id="export-csv-tooltip"
                          data-tooltip-content="Export filtered users as CSV"
                        >
                          <FiDownload className="mr-2" />
                          Export as CSV
                        </ThemedButton>
                        <Tooltip id="export-csv-tooltip" />
                        <ThemedButton
                          onClick={() => exportFilteredUsers('json')}
                          variant="warning"
                          data-tooltip-id="export-json-tooltip"
                          data-tooltip-content="Export filtered users as JSON"
                        >
                          <FiDownload className="mr-2" />
                          Export as JSON
                        </ThemedButton>
                        <Tooltip id="export-json-tooltip" />
                        <ThemedButton
                          onClick={deleteSelectedUsers}
                          disabled={processing || selectedUsers.length === 0 || connectionStatus !== 'connected'}
                          variant={processing || selectedUsers.length === 0 || connectionStatus !== 'connected' ? 'disabled' : 'danger'}
                          data-tooltip-id="delete-users-tooltip"
                          data-tooltip-content="Delete selected users"
                        >
                          <FiTrash2 className="mr-2" />
                          Delete Selected ({selectedUsers.length})
                        </ThemedButton>
                        <Tooltip id="delete-users-tooltip" />
                      </div>
                    </div>
                  </ThemedCard>

                  <ThemedCard className="col-span-2">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">User Data ({filteredUsers.length} users)</h3>
                      <button
                        onClick={selectAllUsers}
                        className={`px-4 py-2 rounded ${
                          theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                        } transition-all duration-200`}
                        data-tooltip-id="select-all-tooltip"
                        data-tooltip-content={selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                      >
                        {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className={theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}>
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium">
                              <input
                                type="checkbox"
                                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                                onChange={selectAllUsers}
                                className="rounded"
                              />
                            </th>
                            {selectedColumns.map(col => (
                              <th
                                key={col}
                                className="px-4 py-2 text-left text-sm font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800"
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
                        <tbody>
                          {currentUsers.map((user, index) => (
                            <tr
                              key={index}
                              className={
                                index % 2 === 0 
                                  ? theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                                  : theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                              }
                            >
                              <td className="px-4 py-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.some(u => u.id === user.id)}
                                  onChange={() => toggleUserSelection(user)}
                                  className="rounded"
                                />
                              </td>
                              {selectedColumns.map(col => (
                                <td
                                  key={`${index}-${col}`}
                                  className="px-4 py-2 text-sm break-words"
                                  style={{ maxWidth: col === 'OrgunitPath' ? '400px' : '200px' }}
                                >
                                  {String(user[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="mt-4 flex justify-between items-center">
                        <button
                          onClick={handlePrevPage}
                          disabled={currentPage === 1}
                          className={`px-4 py-2 rounded ${
                            currentPage === 1 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          } transition-all duration-200`}
                        >
                          Previous
                        </button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages}
                          className={`px-4 py-2 rounded ${
                            currentPage === totalPages 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          } transition-all duration-200`}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </ThemedCard>
                </>
              )}

              {/* Activity Log */}
              <ThemedCard className="col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Activity Log</h3>
                  <ThemedButton 
                    onClick={clearLogs}
                    variant={log.length === 0 ? 'disabled' : 'danger'}
                    className="px-3 py-1"
                  >
                    <FiSquare className="mr-1" />
                    Clear Logs
                  </ThemedButton>
                </div>
                <div className={`h-60 overflow-y-auto p-3 rounded-lg ${
                  theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                }`}>
                  {log.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400">
                      No activity yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {log.map((entry, i) => (
                        <div
                          key={i}
                          className={`flex items-center ${getLogColor(entry.type)} border-l-4 pl-3 py-1 rounded`}
                        >
                          <span className="text-xs opacity-70 mr-2">[{entry.timestamp}]</span>
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
              </ThemedCard>
            </div>
          )}

          {/* Password Management Tab */}
          {activeTab === 'passwords' && (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <ThemedCard>
      <h2 className="text-xl font-semibold mb-4">Password Management</h2>
      <div className="space-y-4">
        <div>
          <label className="block mb-2 font-medium" htmlFor="password-file-upload">
            Upload Password CSV
          </label>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2" id="password-file-upload-desc">
            Upload a CSV file with columns: username, new_password, user_role_ids.
          </div>
          <div
            onClick={() => document.getElementById('password-file-upload').click()}
            className={`border-2 rounded-lg p-6 text-center cursor-pointer ${
              theme === 'dark' 
                ? 'border-gray-700 bg-gray-900 hover:bg-gray-800' 
                : 'border-gray-300 bg-white hover:bg-gray-50'
            } transition-all duration-200`}
          >
            <FiUpload className="mx-auto mb-2 text-2xl" />
            <span>{fileName || 'Choose File or Drag & Drop'}</span>
            <input 
              id="password-file-upload"
              type="file" 
              accept=".csv" 
              onChange={handlePasswordCsvImport} 
              disabled={processingPasswords}
              className="hidden" 
              aria-label="Upload password CSV file"
              aria-describedby="password-file-upload-desc"
            />
          </div>
          {passwordUsers.length > 0 && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              ✅ {passwordUsers.length} users loaded for password update
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <ThemedButton 
            onClick={downloadSamplePasswordCsv}
            variant="warning"
            data-tooltip-id="password-sample-tooltip"
            data-tooltip-content="Download password update sample CSV"
          >
            <FiDownload className="mr-2" />
            Sample CSV
          </ThemedButton>
          <Tooltip id="password-sample-tooltip" />
          <ThemedButton 
            onClick={processPasswordUpdates}
            disabled={processingPasswords || passwordUsers.length === 0 || connectionStatus !== 'connected'}
            variant={processingPasswords || passwordUsers.length === 0 || connectionStatus !== 'connected' ? 'disabled' : 'primary'}
            data-tooltip-id="process-passwords-tooltip"
            data-tooltip-content="Process password updates"
          >
            <FiPlay className="mr-2" />
            {processingPasswords ? 'Processing...' : 'Process Updates'}
          </ThemedButton>
          <Tooltip id="process-passwords-tooltip" />
        </div>
      </div>
    </ThemedCard>

    {processingPasswords && <ProgressBar progress={progress} />}

    {/* Activity Log */}
    <ThemedCard className="col-span-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Activity Log</h3>
        <ThemedButton 
          onClick={clearLogs}
          variant={log.length === 0 ? 'disabled' : 'danger'}
          className="px-3 py-1"
        >
          <FiSquare className="mr-1" />
          Clear Logs
        </ThemedButton>
      </div>
      <div className={`h-60 overflow-y-auto p-3 rounded-lg ${
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
      }`}>
        {log.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400">
            No activity yet
          </p>
        ) : (
          <div className="space-y-2">
            {log.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center ${getLogColor(entry.type)} border-l-4 pl-3 py-1 rounded`}
              >
                <span className="text-xs opacity-70 mr-2">[{entry.timestamp}]</span>
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
    </ThemedCard>
  </div>
)}

          {/* Help Modal */}
          {showHelp && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <ThemedCard className="p-6 max-w-2xl">
                <h2 className="text-xl font-bold mb-4">Help</h2>
                <p className="mb-4">
                  The DHIS2 User Manager allows you to import, export, and delete user data in JSON or CSV formats.
                  Upload a file to import users, retry failed imports, or fetch and filter users from the DHIS2 server for export or deletion.
                  For more details, visit the <a href="https://docs.dhis2.org" className="text-blue-600 hover:underline">DHIS2 documentation</a>.
                </p>
                <ThemedButton 
                  onClick={() => setShowHelp(false)}
                  variant="primary"
                >
                  Close
                </ThemedButton>
              </ThemedCard>
            </div>
          )}
        </main>
        <footer className={`mt-12 text-center text-sm py-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          © 2025 <a href="https://nongu.com.ng/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Joseph Nongu</a>. All rights reserved.
        </footer>
      </div>
    </div>
  );
}

// Wrap App with ThemeProvider
export default function RootApp() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}