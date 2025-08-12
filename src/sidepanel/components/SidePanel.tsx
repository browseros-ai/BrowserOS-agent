import React, { useState, useRef, useEffect, useMemo } from "react";
import { z } from "zod";
import { cn } from "@/sidepanel/lib/utils";
import styles from "../styles/components/SidePanel.module.scss";
import { StreamingMessageDisplay, Message } from "./StreamingMessageDisplay";
import { TabSelector, BrowserTab } from "./TabSelector";
import { HelpSection } from "./HelpSection";
import { useTabsStore } from "../store/tabsStore";
import { BrowserOSProvider } from "@/lib/llm/settings/types";
import { isDevelopmentMode } from "@/config";
import { LLMSettingsReader } from "@/lib/llm/settings/LLMSettingsReader";
import { LoadingPawTrail } from "@/sidepanel/v2/components/ui/Icons";

// Icons

const SendIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

const PauseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    {/* Pause icon with two vertical bars */}
    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
  </svg>
);

const ResetIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

const HelpIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
  </svg>
);

const TabsIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {/* Page icon with folded corner */}
    <path d="M14 2H6a2 2 0 0 0 -2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);


// Example prompts to show users what they can do
const EXAMPLE_PROMPTS = [
  // Tab Management & Cleanup
  "List all my tabs",
  "Close all my YouTube tabs",
  "Organize my tabs by topic",

  // Content Analysis & Understanding
  "Summarize this article for me",
  "What are the key points on this page?",
];

// Browser task examples for agent mode
const BROWSER_TASK_EXAMPLES = [
  'Open amazon.com and order sensodyne toothpaste',
  "Write a tweet saying Hello World",
  'Find top rated headphones under 100$',
  'Extract all news headlines from this page',
];

// Combine all examples - prioritizing agent tasks first
const ALL_EXAMPLES = [
  // Browser automation tasks (agent mode)
  ...BROWSER_TASK_EXAMPLES,
  // Productivity tasks (chat mode)
  ...EXAMPLE_PROMPTS
];

// Function to get 3 random examples
const getRandomExamples = (): string[] => {
  const shuffled = [...ALL_EXAMPLES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
};

// Zod schemas for type safety
const SidePanelStateSchema = z.object({
  input: z.string(), // Current input text
  isProcessing: z.boolean(), // Whether currently processing a task
  isConnected: z.boolean(), // Connection status to background script
  currentQuery: z.string().optional(), // Currently executing query
  examples: z.array(z.string()), // Current example prompts
  showHelp: z.boolean(), // Whether to show help modal
  showTabSelector: z.boolean(), // Whether to show tab selector
  selectedTabs: z.array(z.number()), // Selected tab IDs
});

export type SidePanelState = z.infer<typeof SidePanelStateSchema>;

interface SidePanelProps {
  className?: string;
  onNewTask?: (task: string, tabIds?: number[]) => void;
  onCancelTask?: () => void;
  onReset?: () => void;
  onClose?: () => void;
  isConnected?: boolean;
  isProcessing?: boolean;
  messages?: Message[];
  externalIntent?: string | null;  // Intent from external source (web page bubble)
  onExternalIntentHandled?: () => void;  // Callback when external intent is handled
}

/**
 * Redesigned side panel component with modern UX patterns.
 * Features centered input when idle and clean streaming display when active.
 */
export function SidePanel({
  className,
  onNewTask,
  onCancelTask,
  onReset,
  onClose,
  isConnected = false,
  isProcessing = false,
  messages = [],
  externalIntent,
  onExternalIntentHandled,
}: SidePanelProps): JSX.Element {

  const [state, setState] = useState<SidePanelState>({
    input: "",
    isProcessing,
    isConnected,
    currentQuery: undefined,
    examples: getRandomExamples(),
    showHelp: false,
    showTabSelector: false,
    selectedTabs: [],
  });
  
  // Separate state for tracking if we have an active task - used for UI elements like pause button
  // Pause button appears whenever a task is processing – either locally or as reported by the parent
  // Show pause button aggressively: if processing or any streaming message is still in-progress
  const hasActiveTask = state.isProcessing || isProcessing || messages.some(m => (
    (m.type === 'streaming-llm' || m.type === 'streaming-tool') && !m.isComplete
  ));

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageAreaRef = useRef<HTMLDivElement>(null);  // Add ref for message area
  const [isUserScrolling, setIsUserScrolling] = useState(false);  // Track if user is manually scrolling

  // Debug state for LLM settings (dev mode only)
  const [llmProvider, setLlmProvider] = useState<BrowserOSProvider | null>(null);
  const [llmSettingsError, setLlmProviderError] = useState<string | null>(null);

  // Get tabs data and actions from Zustand store
  const { 
    openTabs,
    selectedTabs,
    currentTabId,
    toggleTabSelection,
    clearSelectedTabs,
    getContextTabs,
    fetchOpenTabs,
    updateIntentPredictions
  } = useTabsStore();

  // Get full tab objects for selected tabs
  const selectedTabsData = useMemo(() => {
    return openTabs.filter(tab => selectedTabs.includes(tab.id));
  }, [openTabs, selectedTabs]);
 

  // Handle external intent (from web page bubble click)
  useEffect(() => {
    if (externalIntent && isConnected && !state.isProcessing) {
      // Fill the input with the intent text
      setState(prev => ({
        ...prev,
        input: externalIntent
      }));
      
      // Auto-submit after a brief delay for visual feedback
      setTimeout(() => {
        if (isConnected && !state.isProcessing) {
          submitTask(externalIntent);
        }
      }, 200);
      
      // Mark as handled
      onExternalIntentHandled?.();
    }
  }, [externalIntent, isConnected, state.isProcessing, onExternalIntentHandled]);
  
  // Fetch open tabs when component mounts and load stored intent predictions
  useEffect(() => {
    // Fetch tabs immediately when side panel opens
    fetchOpenTabs();
    
    // Load any stored intent predictions from chrome.storage.session
    const loadStoredPredictions = async () => {
      try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const httpTabs = tabs.filter(tab => 
          tab.url && tab.id && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))
        );
        
        // Load predictions for each tab
        for (const tab of httpTabs) {
          if (tab.id) {
            const key = `intent_${tab.id}`;
            const stored = await chrome.storage.session.get(key);
            if (stored[key]) {
              updateIntentPredictions(stored[key]);
            }
          }
        }
      } catch (error) {
      }
    };
    
    loadStoredPredictions();
    
    // Also fetch periodically to keep updated
    const interval = setInterval(() => {
      fetchOpenTabs();
    }, 5000); // Every 5 seconds
    
    return () => clearInterval(interval);
  }, [fetchOpenTabs, updateIntentPredictions]);
  

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";
      // Set height to scrollHeight to fit content
      const newHeight = Math.max(40, textarea.scrollHeight); // Ensure minimum height of 40px
      textarea.style.height = `${newHeight}px`;
    }
  };

  // Update state when props change
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      isProcessing,
      isConnected,
    }));
  }, [isProcessing, isConnected]);
  


  // Removed mode-dependent example updates since we're unifying the experience

  // Load LLM settings in dev mode
  useEffect(() => {
    if (isDevelopmentMode()) {
      LLMSettingsReader.read()
        .then(settings => {
          setLlmProvider(settings);
          setLlmProviderError(null);
        })
        .catch(error => {
          setLlmProviderError(error.message || 'Failed to load settings');
          console.error('Failed to load LLM settings:', error);
        });
    }
  }, []);

  // Function to refresh LLM settings
  const refreshLLMSettings = () => {
    setLlmProvider(null); // Show loading state
    LLMSettingsReader.read()
      .then(settings => {
        setLlmProvider(settings);
        setLlmProviderError(null);
      })
      .catch(error => {
        setLlmProviderError(error.message || 'Failed to load settings');
        console.error('Failed to load LLM settings:', error);
      });
  };

  // Focus input on mount with delay to ensure panel is ready
  useEffect(() => {
    // Small delay to ensure the side panel is fully rendered
    const focusTimer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Set initial height explicitly
        inputRef.current.style.height = "40px";
      }
    }, 100);

    // Retry focus if it fails (handles browser timing issues)
    const retryTimer = setTimeout(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 300);

    return () => {
      clearTimeout(focusTimer);
      clearTimeout(retryTimer);
    };
  }, []); // Empty dependency array - runs only on mount

  // Re-focus input when processing completes
  useEffect(() => {
    if (inputRef.current && !isProcessing) {
      inputRef.current.focus();
      // Set initial height explicitly
      inputRef.current.style.height = "40px";
    }
  }, [isProcessing]);

  // Adjust height when input changes
  useEffect(() => {
    if (state.input) {
      adjustTextareaHeight();
    } else if (inputRef.current) {
      // Reset to minimum height when input is empty
      inputRef.current.style.height = "40px";
    }
  }, [state.input]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      if (messageAreaRef.current) {
        const element = messageAreaRef.current;
        const { scrollTop, scrollHeight, clientHeight } = element;
        const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 100; // Within 100px of bottom
        
        // Always scroll to bottom if user hasn't manually scrolled up, or if it's a new conversation
        if (!isUserScrolling || isNearBottom || messages.length <= 1) {
          // Try both methods for maximum compatibility
          element.scrollTop = scrollHeight;
          element.scrollTo({
            top: scrollHeight,
            behavior: 'smooth'
          });
        }
      }
    };

    // Use requestAnimationFrame and timeouts for better timing
    const scroll = () => {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    };

    // Use multiple timeouts to ensure DOM updates are captured
    const timeoutId1 = setTimeout(scroll, 0);
    const timeoutId2 = setTimeout(scroll, 50);
    const timeoutId3 = setTimeout(scroll, 200);
    
    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
    };
  }, [messages, isUserScrolling]);

  // Handle scroll event to detect user manual scrolling
  useEffect(() => {
    const messageArea = messageAreaRef.current;
    if (!messageArea) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      setIsUserScrolling(true);
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Reset user scrolling flag after 2 seconds of no scrolling
      scrollTimeout = setTimeout(() => {
        setIsUserScrolling(false);
      }, 2000);

      // If user scrolls to bottom, reset the flag immediately
      const { scrollTop, scrollHeight, clientHeight } = messageArea;
      const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 10;
      if (isAtBottom) {
        setIsUserScrolling(false);
      }
    };

    messageArea.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      messageArea.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, []);

  // Reset user scrolling flag when conversation is reset
  useEffect(() => {
    if (messages.length === 0) {
      setIsUserScrolling(false);
    }
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Don't submit if TabSelector is open - let it handle Enter key
    if (state.showTabSelector) {
      return;
    }
    
    if (!state.input.trim() || !isConnected) return;

    const query = state.input.trim();
    submitTask(query);
  };
  
  // Separate function to submit a task with a specific query
  // This bypasses input validation and is used for follow-up tasks
  const submitTask = (query: string) => {
    if (!query || !isConnected) return;
    
    // Mark local state as processing immediately for UI feedback
    setState(prev => ({
      ...prev,
      isProcessing: true,
    }));
    
    const contextTabs = getContextTabs();
    const tabIds = contextTabs.map(tab => tab.id);

    // Store the current query and start processing
    setState((prev) => ({
      ...prev,
      input: "",
      isProcessing: true,
      currentQuery: query,
      showTabSelector: false,
    }));
    
    // Clear selected tabs in store after submission
    clearSelectedTabs();

    // Call parent handler
    onNewTask?.(query, tabIds.length > 0 ? tabIds : undefined);
  };

  const handleCancel = () => {
    setState((prev) => ({
      ...prev,
      isProcessing: false,
      currentQuery: undefined,
    }));
    
    // Don't clear hasActiveTask here - let parent's isProcessing update handle it
    // This prevents the pause button from flickering during interrupt + follow-up
    
    onCancelTask?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Don't handle Enter if TabSelector is open
      if (state.showTabSelector) {
        e.preventDefault(); // Prevent new line creation
        return;
      }
      e.preventDefault();
      
      // If processing, single Enter interrupts and submits follow-up
      if (hasActiveTask) {
        const currentInput = state.input.trim(); // Capture current input before state changes
        
        // Cancel current task first
        handleCancel();
        
        // If there's a follow-up query, keep the pause button visible
        if (currentInput) {
          // Keep pause button visible by flagging local processing immediately
          setState(prev => ({ ...prev, isProcessing: true }));
          
          // Wait for proper cancellation before submitting follow-up
          setTimeout(() => {
            // Submit the follow-up task directly with the captured input
            submitTask(currentInput);
          }, 300); // Small delay to ensure cancellation completes
        }
      } else {
        // Normal submission when not processing
        handleSubmit(e as any);
      }
    }
    if (e.key === "Escape") {
      if (state.showTabSelector) {
        // Just close tab selector, keep @ in input
        setState((prev) => ({
          ...prev,
          showTabSelector: false
        }));
        inputRef.current?.focus();
      } else if (hasActiveTask) {
        // Then handle cancellation if processing
        handleCancel();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setState((prev) => ({ 
      ...prev, 
      input: newValue,
    }));
    
    // Check if user typed '@' to trigger tab selector
    const lastChar = newValue.slice(-1);
    if (lastChar === '@' && !state.showTabSelector) {
      // Only trigger if @ is at start or preceded by space
      const beforeAt = newValue.slice(0, -1);
      if (beforeAt === '' || beforeAt.endsWith(' ')) {
        setState((prev) => ({ ...prev, showTabSelector: true }));
      }
    }
    
    // Hide tab selector if input is cleared or '@' is removed
    if (newValue === '' && state.showTabSelector) {
      setState((prev) => ({ ...prev, showTabSelector: false }));
    }
  };

  const handleExampleClick = (example: string) => {
    setState((prev) => ({ ...prev, input: example }));
    inputRef.current?.focus();
    // Trigger height adjustment after setting example
    setTimeout(adjustTextareaHeight, 0);
  };

  const handleReset = () => {
    // Clear all messages and reset state
    setState((prev) => ({
      ...prev,
      input: "",
      isProcessing: false,
      currentQuery: undefined,
      examples: getRandomExamples(), // Get new random examples
      showHelp: false, // Close help if open
      showTabSelector: false,
    }));
    
    // Clear selected tabs in store
    clearSelectedTabs();
    

    
    // Reset scrolling state
    setIsUserScrolling(false);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "40px";
    }

    // Call parent's reset handler to clear messages
    onReset?.();
  };

  const toggleHelp = () => {
    setState((prev) => ({ ...prev, showHelp: !prev.showHelp }));
  };

  const toggleTabSelector = () => {
    setState((prev) => ({ ...prev, showTabSelector: !prev.showTabSelector }));
  };

  const handleTabSelectorClose = () => {
    setState((prev) => {
      let newInput = prev.input;
      
      // Find the last @ that triggered the selector (at start or after space)
      const matches = [...prev.input.matchAll(/(^@|\s@)/g)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const atIndex = lastMatch.index! + (lastMatch[0].startsWith(' ') ? 1 : 0);
        
        // Remove @ and everything after it
        newInput = prev.input.slice(0, atIndex) + prev.input.slice(prev.input.length);
      }
      
      return {
        ...prev,
        showTabSelector: false,
        input: newInput
      };
    });
    
    // Focus back on input
    inputRef.current?.focus();
  };

  const removeSelectedTab = (tabId: number) => {
    toggleTabSelection(tabId);
  };
  

  const hasContent = messages.length > 0 || state.isProcessing;

  return (
    <div className={cn(styles.container, className)}>
      {/* Help Modal - using new HelpSection component */}
      <HelpSection 
        isOpen={state.showHelp}
        onClose={toggleHelp}
      />

      {/* Header with branding and action buttons */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.brandTitle}>
            Your browser assistant
          </h1>
        </div>
        
        <div className={styles.headerActions}>
          {/* Removed mode toggle - unified experience */}

          {/* Pause button - only visible when we have an active task */}
          {hasActiveTask && (
            <button
              onClick={handleCancel}
              className={styles.actionButton}
              title="Pause current task (Esc)"
            >
              <PauseIcon />
            </button>
          )}

          {/* Reset button - only visible when there's content */}
          {hasContent && (
            <button
              onClick={handleReset}
              className={styles.actionButton}
              title="Clear conversation"
            >
              <ResetIcon />
            </button>
          )}

          {/* Help button */}
          <button
            onClick={toggleHelp}
            className={cn(styles.actionButton, styles.helpButton)}
            title="Show help"
          >
            <HelpIcon />
          </button>

          {/* Tab selector button */}
          <button
            onClick={toggleTabSelector}
            className={styles.actionButton}
            title="Select tabs"
          >
            <TabsIcon />
          </button>
        </div>
      </div>

      {/* Debug Box - Only shown in dev mode */}
      {isDevelopmentMode() && (
        <div className={styles.debugBox}>
          <details className={styles.debugDetails}>
            <summary className={styles.debugSummary}>
              🔧 Debug: LLM Settings 
              <span className={styles.debugProvider}>
                ({llmProvider?.name || <LoadingPawTrail />})
              </span>
              <button
                className={styles.debugRefreshButton}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  refreshLLMSettings();
                }}
                title="Refresh settings"
              >
                <RefreshIcon />
              </button>
            </summary>
            <div className={styles.debugContent}>
              {llmSettingsError ? (
                <div className={styles.debugError}>❌ Error: {llmSettingsError}</div>
              ) : llmProvider ? (
                <div className={styles.debugSettings}>
                  <div className={styles.debugSection}>
                    <strong>Provider Name:</strong> {llmProvider.name}
                  </div>
                  <div className={styles.debugSection}>
                    <strong>Provider Type:</strong> {llmProvider.type}
                  </div>
                  
                  {/* Provider Details */}
                  <div className={styles.debugSection}>
                    <div className={styles.debugSectionTitle}>Configuration:</div>
                    <div className={styles.debugItem}>
                      <strong>Model:</strong> {llmProvider.modelId || 'default'}
                    </div>
                    {llmProvider.baseUrl && (
                      <div className={styles.debugItem}>
                        <strong>Base URL:</strong> {llmProvider.baseUrl}
                      </div>
                    )}
                    {llmProvider.apiKey && (
                      <div className={styles.debugItem}>
                        <strong>API Key:</strong> {'***' + llmProvider.apiKey.slice(-4)}
                      </div>
                    )}
                    {llmProvider.modelConfig && (
                      <>
                        <div className={styles.debugItem}>
                          <strong>Temperature:</strong> {llmProvider.modelConfig.temperature}
                        </div>
                        <div className={styles.debugItem}>
                          <strong>Context Window:</strong> {llmProvider.modelConfig.contextWindow}
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Provider Info */}
                  <div className={styles.debugSection}>
                    <div className={styles.debugItem}>
                      <strong>Built-in:</strong> {llmProvider.isBuiltIn ? 'Yes' : 'No'}
                    </div>
                    <div className={styles.debugItem}>
                      <strong>Default:</strong> {llmProvider.isDefault ? 'Yes' : 'No'}
                    </div>
                  </div>
                  
                  {/* BrowserOS Indicator */}
                  {llmProvider.type === 'browseros' && (
                    <div className={styles.debugNote}>
                      ℹ️ Using BrowserOS built-in provider - no API key required
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.debugLoading}>
                  {/*<LoadingPawTrail />*/}
                  <span>Loading settings</span>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* Main content area */}
      <div className={styles.mainContent}>
        {!hasContent ? (
          // Welcome state with examples
          <div className={styles.welcomeState}>
            <h2 className={styles.welcomeTitle}>
              What can I help you with?
            </h2>
            <div className={styles.examplesGrid}>
              {state.examples.map((example, index) => (
                <button
                  key={index}
                  className={styles.exampleCard}
                  onClick={() => handleExampleClick(example)}
                  disabled={!isConnected}
                >
                  <span className={styles.exampleText}>{example}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Message display area
          <div className={styles.messageArea} ref={messageAreaRef}>
            <StreamingMessageDisplay
              messages={messages}
              className={styles.messageDisplay}
            />
          </div>
        )}
      </div>

      {/* Input section - always at bottom */}
      <div className={styles.inputSection}>
        
        {/* Selected tabs display */}
        {selectedTabsData.length > 0 && (
          <div className={styles.selectedTabsContainer}>
            {selectedTabsData.map((tab) => (
              <div key={tab.id} className={styles.selectedTabPill}>
                {tab.favIconUrl && (
                  <img src={tab.favIconUrl} alt="" className={styles.tabIconSmall} />
                )}
                <span className={styles.selectedTabTitle}>{tab.title}</span>
                <button
                  type="button"
                  className={styles.removeTabBtn}
                  onClick={() => removeSelectedTab(tab.id)}
                  aria-label="Remove tab"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tab selector - positioned above input when active */}
        {state.showTabSelector && (
          <div className={styles.tabSelectorWrapper}>
            <TabSelector
              isOpen={state.showTabSelector}
              onClose={handleTabSelectorClose}
              className={styles.tabSelectorDropdown}
              filterQuery={(() => {
                // Extract text after @ for filtering
                const lastAtIndex = state.input.lastIndexOf('@');
                if (lastAtIndex !== -1) {
                  return state.input.slice(lastAtIndex + 1);
                }
                return '';
              })()}
            />
          </div>
        )}
        
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          
          <div className={styles.inputWrapper}>
            <textarea
              ref={inputRef}
              value={state.input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                (isProcessing || state.isProcessing)
                  ? "Feel free to interrupt my task if you have updated instructions"
                  : "Ask me to do something..."
              }
              className={styles.inputField}
              disabled={!isConnected}
              rows={1}
              style={{ height: "40px" }} // Set initial inline style
            />
            <button
              type="submit"
              className={cn(
                styles.sendButton,
                isConnected && state.input.trim()
                  ? styles.sendButtonEnabled
                  : styles.sendButtonDisabled,
              )}
              disabled={
                !isConnected || !state.input.trim()
              }
              title="Send message"
            >
              <SendIcon />
            </button>
          </div>
          <div className={styles.helpText}>
            {(isProcessing || state.isProcessing) 
              ? "Press Enter twice to interrupt • Shift+Enter for new line"
              : "Press Enter to send • Shift+Enter for new line"
            }
          </div>
        </form>
      </div>
    </div>
  );
}

