import React, { useState, useEffect } from 'react'
import { z } from 'zod'
import styles from '../styles/components/HelpSection.module.scss'

// Icons
const CloseIcon = () => (
  <svg
    width='20'
    height='20'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M18 6 6 18' />
    <path d='M6 6l12 12' />
  </svg>
)

const PauseIcon = () => (
  <svg
    width='16'
    height='16'
    viewBox='0 0 24 24'
    aria-hidden='true'
    focusable='false'
  >
    <rect x='6' y='4' width='4' height='16' rx='1' fill='currentColor' />
    <rect x='14' y='4' width='4' height='16' rx='1' fill='currentColor' />
  </svg>
)

const RefreshIcon = () => (
  <svg
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' />
    <path d='M21 3v5h-5' />
    <path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' />
    <path d='M8 16H3v5' />
  </svg>
)

const RobotIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <rect x='3' y='11' width='18' height='10' rx='2' />
    <circle cx='12' cy='5' r='2' />
    <path d='M12 7v4' />
    <line x1='8' y1='16' x2='8' y2='16' />
    <line x1='16' y1='16' x2='16' y2='16' />
  </svg>
)

const LinkIcon = () => (
  <svg
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
    <polyline points='15 3 21 3 21 9' />
    <line x1='10' y1='14' x2='21' y2='3' />
  </svg>
)

// Props schema
const HelpSectionPropsSchema = z.object({
  isOpen: z.boolean(), // Whether the help section is open
  onClose: z.function().args().returns(z.void()), // Close handler
  className: z.string().optional() // Additional CSS classes
})

type HelpSectionProps = z.infer<typeof HelpSectionPropsSchema>

// Agent examples
const AGENT_EXAMPLES = {
  browse: {
    title: '🌐 Web Navigation & Automation',
    description:
      'I can navigate websites, fill forms, click buttons, and automate complex web tasks',
    examples: [
      'Open amazon.com and search for wireless headphones under $100',
      'Accept all LinkedIn connection requests on this page',
      'Add this item to my shopping cart and complete the purchase'
    ]
  },
  answer: {
    title: '📊 Data Extraction & Analysis',
    description:
      "I can read, analyze, and extract information from any webpage you're viewing",
    examples: [
      'Summarize this research paper in bullet points',
      'Extract all email addresses from this page',
      'What are the key features mentioned in this product description?'
    ]
  },
  productivity: {
    title: '📑 Tab & Browser Management',
    description:
      'I can organize your tabs, manage bookmarks, and help you work more efficiently',
    examples: [
      'List all tabs in this window',
      'Close all YouTube tabs',
      'Organize my tabs by topic',
      "Save current tabs as 'Work' session",
      "Resume my 'Work' session from yesterday"
    ]
  }
}

/**
 * Help section component displaying comprehensive usage instructions
 */
export function HelpSection ({
  isOpen,
  onClose,
  className
}: HelpSectionProps): JSX.Element | null {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    // Get version from manifest
    const manifest = chrome.runtime.getManifest();
    setVersion(manifest.version || '');
  }, []);

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${className || ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <RobotIcon />
            <h2 className={styles.title}>BrowserOS Agent</h2>
            {version && <span className={styles.version}>v{version}</span>}
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            title='Close help'
          >
            <CloseIcon />
          </button>
        </div>

        {/* Introduction */}
        <div className={styles.intro}>
          <p className={styles.introText}>
            I'm your intelligent browser automation assistant. I can navigate
            websites, extract information, and manage your browsing
            productivity—all through natural conversation.
          </p>
        </div>

        {/* Quick Controls */}
        <div className={styles.controlsSection}>
          <h3 className={styles.sectionTitle}>Quick Controls</h3>
          <div className={styles.controlsGrid}>
            <div className={styles.controlItem}>
              <button className={styles.controlButton} disabled>
                <PauseIcon />
              </button>
              <div className={styles.controlInfo}>
                <span className={styles.controlLabel}>Pause</span>
                <span className={styles.controlDesc}>
                  Stop execution at any time
                </span>
              </div>
            </div>

            <div className={styles.controlItem}>
              <button className={styles.controlButton} disabled>
                <RefreshIcon />
              </button>
              <div className={styles.controlInfo}>
                <span className={styles.controlLabel}>Reset</span>
                <span className={styles.controlDesc}>
                  Start a fresh conversation
                </span>
              </div>
            </div>
          </div>

          <div className={styles.interruptNote}>
            💡 <strong>Pro tip:</strong> You can interrupt me anytime by typing
            a new instruction. I'll pause what I'm doing and switch to your new
            task immediately.
          </div>
        </div>

        {/* Agent Capabilities */}
        <div className={styles.capabilitiesSection}>
          <h3 className={styles.sectionTitle}>What I Can Do</h3>

          {Object.entries(AGENT_EXAMPLES).map(([key, agent]) => (
            <div key={key} className={styles.agentSection}>
              <h4 className={styles.agentTitle}>{agent.title}</h4>
              <p className={styles.agentDescription}>{agent.description}</p>
              <div className={styles.examplesGrid}>
                {agent.examples.map((example, index) => (
                  <div key={index} className={styles.exampleChip}>
                    "{example}"
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Learn More */}
        <div className={styles.learnMore}>
          <a
            href='https://bit.ly/BrowserOS-setup'
            target='_blank'
            rel='noopener noreferrer'
            className={styles.learnMoreLink}
          >
            <LinkIcon />
            <span>View detailed usage guide</span>
          </a>
        </div>
      </div>
    </div>
  )
}
