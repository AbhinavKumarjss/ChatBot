import { useState, useEffect } from 'react';
import { 
  Database, 
  MessageSquare, 
  Mic, 
  Globe, 
  Settings, 
  Search, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Save,

  RotateCcw,
  Activity
} from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('pinecone');
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState('');
  const [chatPrompt, setChatPrompt] = useState('');
  const [voicePrompt, setVoicePrompt] = useState('');
  
  // Form states
  const [indexName, setIndexName] = useState('default');
  const [queryText, setQueryText] = useState('');
  const [queryTop, setQueryTop] = useState(5);
  const [textArray, setTextArray] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeLimit, setScrapeLimit] = useState(10);
  const [newChatPrompt, setNewChatPrompt] = useState('');
  const [newVoicePrompt, setNewVoicePrompt] = useState('');
  
  // Results states
  const [queryResults, setQueryResults] = useState(null);
  const [scrapeResults, setScrapeResults] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const API_BASE = import.meta.env.VITE_SERVER_API_URL; // Adjust this to your API base URL

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const apiCall = async (endpoint, method = 'GET', body = null) => {
    setLoading(true);
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) options.body = JSON.stringify(body);
      
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await response.json();
      return data;
    } catch (error) {
      addNotification(`Error: ${error.message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    loadCurrentIndex();
    loadPrompts();
  }, []);

  const loadCurrentIndex = async () => {
    const data = await apiCall('/pinecone/index/get');
    if (data) setCurrentIndex(data.name);
  };

  const loadPrompts = async () => {
    const chatData = await apiCall('/prompt/chat/get');
    const voiceData = await apiCall('/prompt/voice/get');
    if (chatData) setChatPrompt(chatData.prompt);
    if (voiceData) setVoicePrompt(voiceData.prompt);
  };

  // Pinecone operations
  const changeIndex = async () => {
    const data = await apiCall('/pinecone/index/change', 'POST', { indexName });
    if (data?.success) {
      addNotification(`Index changed to ${indexName}${data.created ? ' (created new)' : ''}`, 'success');
      setCurrentIndex(indexName);
    }
  };

  const deleteIndex = async () => {
    if (confirm('Are you sure you want to delete the current index?')) {
      const data = await apiCall('/pinecone/index/delete');
      if (data?.success) {
        addNotification('Index deleted successfully', 'success');
        setCurrentIndex('');
      }
    }
  };

  const queryIndex = async () => {
    const data = await apiCall('/pinecone/data/query', 'POST', { 
      query: queryText, 
      top: queryTop 
    });
    if (data) {
      setQueryResults(data);
      addNotification('Query executed successfully', 'success');
    }
  };

  const addData = async () => {
    const textArrayData = textArray.split('\n').filter(line => line.trim());
    const data = await apiCall('/pinecone/data/add', 'POST', { textarray: textArrayData });
    if (data?.success) {
      addNotification('Data added successfully', 'success');
      setTextArray('');
    }
  };

  // Prompt operations
  const setChatPromptHandler = async () => {
    const data = await apiCall('/prompt/chat/set', 'POST', { systemprompt: newChatPrompt });
    if (data) {
      addNotification('Chat prompt updated', 'success');
      setChatPrompt(newChatPrompt);
      setNewChatPrompt('');
    }
  };

  const setVoicePromptHandler = async () => {
    const data = await apiCall('/prompt/voice/set', 'POST', { systemprompt: newVoicePrompt });
    if (data) {
      addNotification('Voice prompt updated', 'success');
      setVoicePrompt(newVoicePrompt);
      setNewVoicePrompt('');
    }
  };

  const resetChatPrompt = async () => {
    const data = await apiCall('/prompt/chat/reset');
    if (data?.success) {
      addNotification('Chat prompt reset', 'success');
      loadPrompts();
    }
  };

  const resetVoicePrompt = async () => {
    const data = await apiCall('/prompt/voice/reset');
    if (data?.success) {
      addNotification('Voice prompt reset', 'success');
      loadPrompts();
    }
  };

  // Scraping operation
  const scrapeWebsite = async () => {
    const data = await apiCall('/scrape/website', 'POST', { 
      url: scrapeUrl, 
      limit: scrapeLimit 
    });
    if (data?.success) {
      setScrapeResults(data.text);
      addNotification(`Successfully scraped ${data.text?.length || 0} chunks`, 'success');
    } else {
      addNotification(data?.message || 'Scraping failed', 'error');
    }
  };

  const tabs = [
    { id: 'pinecone', label: 'Pinecone', icon: Database },
    { id: 'prompts', label: 'Prompts', icon: MessageSquare },
    { id: 'scraping', label: 'Web Scraping', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              {loading && <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`px-4 py-3 rounded-lg shadow-lg ${
              notification.type === 'error' 
                ? 'bg-red-100 text-red-800 border border-red-200' 
                : notification.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}
          >
            {notification.message}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Pinecone Tab */}
        {activeTab === 'pinecone' && (
          <div className="space-y-8">
            {/* Current Index Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Current Index</h2>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Active Index: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{currentIndex || 'None'}</span>
                </span>
                <button
                  onClick={loadCurrentIndex}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Index Management */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Index Management</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Index Name
                    </label>
                    <input
                      type="text"
                      value={indexName}
                      onChange={(e) => setIndexName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter index name"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={changeIndex}
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Switch/Create Index
                    </button>
                    <button
                      onClick={deleteIndex}
                      disabled={loading}
                      className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Query Index */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Query Index</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Query Text
                    </label>
                    <textarea
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your query..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Top Results
                    </label>
                    <input
                      type="number"
                      value={queryTop}
                      onChange={(e) => setQueryTop(parseInt(e.target.value))}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={queryIndex}
                    disabled={loading || !queryText}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Query Index
                  </button>
                </div>
              </div>
            </div>

            {/* Add Data */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Data to Index</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Array (one item per line)
                  </label>
                  <textarea
                    value={textArray}
                    onChange={(e) => setTextArray(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter text items, one per line..."
                  />
                </div>
                <button
                  onClick={addData}
                  disabled={loading || !textArray.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Data
                </button>
              </div>
            </div>

            {/* Query Results */}
            {queryResults && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Query Results</h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {Array.isArray(queryResults) ? queryResults.length : 0} results
                  </span>
                </div>
                
                {Array.isArray(queryResults) && queryResults.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {queryResults.map((result, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                              {index + 1}
                            </span>
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">
                                Match #{index + 1}
                              </h4>
                              {result.score !== undefined && (
                                <p className="text-xs text-gray-500">
                                  Score: {typeof result.score === 'number' ? result.score.toFixed(4) : result.score}
                                </p>
                              )}
                            </div>
                          </div>
                          {result.score !== undefined && (
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${Math.max(0, Math.min(100, (result.score * 100)))}%` }}
                                ></div>
                              </div>
                              <span className="ml-2 text-xs text-gray-600">
                                {Math.round((result.score || 0) * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {result.id && (
                          <div className="mb-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono bg-gray-100 text-gray-800">
                              ID: {result.id}
                            </span>
                          </div>
                        )}
                        
                        {result.metadata && (
                          <div className="mb-3">
                            <h5 className="text-xs font-medium text-gray-700 mb-2">Metadata:</h5>
                            <div className="bg-gray-50 rounded-md p-3">
                              {typeof result.metadata === 'object' ? (
                                <div className="space-y-1">
                                  {Object.entries(result.metadata).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="text-xs font-medium text-gray-600">{key}:</span>
                                      <span className="text-xs text-gray-800 ml-2 break-all">
                                        {typeof value === 'string' && value.length > 100 
                                          ? `${value.substring(0, 100)}...`
                                          : String(value)
                                        }
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                                  {JSON.stringify(result.metadata, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {result.values && (
                          <div className="mb-3">
                            <h5 className="text-xs font-medium text-gray-700 mb-2">
                              Vector Values ({Array.isArray(result.values) ? result.values.length : 0} dimensions):
                            </h5>
                            <div className="bg-gray-50 rounded-md p-3">
                              <div className="text-xs text-gray-800 font-mono">
                                [{Array.isArray(result.values) ? result.values.slice(0, 5).map(v => 
                                  typeof v === 'number' ? v.toFixed(4) : v
                                ).join(', ') : 'N/A'}
                                {Array.isArray(result.values) && result.values.length > 5 && `, ... +${result.values.length - 5} more`}]
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {result.text && (
                          <div>
                            <h5 className="text-xs font-medium text-gray-700 mb-2">Content:</h5>
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-md">
                              <p className="text-sm text-gray-800 leading-relaxed">
                                {result.text}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* Fallback for any other properties */}
                        {Object.keys(result).filter(key => 
                          !['score', 'id', 'metadata', 'values', 'text'].includes(key)
                        ).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <h5 className="text-xs font-medium text-gray-700 mb-2">Additional Data:</h5>
                            <div className="bg-gray-50 rounded-md p-3">
                              <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                                {JSON.stringify(
                                  Object.fromEntries(
                                    Object.entries(result).filter(([key]) => 
                                      !['score', 'id', 'metadata', 'values', 'text'].includes(key)
                                    )
                                  ), 
                                  null, 2
                                )}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Search className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Try adjusting your query or increasing the result limit.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Prompts Tab */}
        {activeTab === 'prompts' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chat Prompts */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Chat Prompts
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Chat Prompt
                    </label>
                    <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-800 max-h-32 overflow-y-auto">
                      {chatPrompt || 'No prompt set'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Chat Prompt
                    </label>
                    <textarea
                      value={newChatPrompt}
                      onChange={(e) => setNewChatPrompt(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter new chat system prompt..."
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={setChatPromptHandler}
                      disabled={loading || !newChatPrompt}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Set Prompt
                    </button>
                    <button
                      onClick={resetChatPrompt}
                      disabled={loading}
                      className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Voice Prompts */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Mic className="h-5 w-5 mr-2" />
                  Voice Prompts
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Voice Prompt
                    </label>
                    <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-800 max-h-32 overflow-y-auto">
                      {voicePrompt || 'No prompt set'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Voice Prompt
                    </label>
                    <textarea
                      value={newVoicePrompt}
                      onChange={(e) => setNewVoicePrompt(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter new voice system prompt..."
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={setVoicePromptHandler}
                      disabled={loading || !newVoicePrompt}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Set Prompt
                    </button>
                    <button
                      onClick={resetVoicePrompt}
                      disabled={loading}
                      className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Web Scraping Tab */}
        {activeTab === 'scraping' && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Globe className="h-5 w-5 mr-2" />
                Website Scraping
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={scrapeUrl}
                      onChange={(e) => setScrapeUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Link Limit
                    </label>
                    <input
                      type="number"
                      value={scrapeLimit}
                      onChange={(e) => setScrapeLimit(parseInt(e.target.value))}
                      min="1"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={scrapeWebsite}
                  disabled={loading || !scrapeUrl}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Scrape Website
                </button>
              </div>
            </div>

            {/* Scraping Results */}
            {scrapeResults && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Scraping Results</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scraped {scrapeResults.length} chunks successfully
                </p>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {scrapeResults.slice(0, 10).map((chunk, index) => (
                    <div key={index} className="bg-gray-50 rounded-md p-3 border">
                      <div className="text-xs text-gray-500 mb-2">
                        <span className="font-medium">Source:</span> {chunk.source_url}
                        <span className="ml-4"><span className="font-medium">Chunk:</span> {chunk.chunk_index + 1}/{chunk.total_chunks}</span>
                        <span className="ml-4"><span className="font-medium">Chars:</span> {chunk.char_count}</span>
                      </div>
                      <div className="text-sm text-gray-800">
                        {chunk.content.slice(0, 200)}...
                      </div>
                    </div>
                  ))}
                  {scrapeResults.length > 10 && (
                    <div className="text-sm text-gray-500 text-center">
                      ... and {scrapeResults.length - 10} more chunks
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;