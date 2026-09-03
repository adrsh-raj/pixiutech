export interface CodeHint {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
  icon: string
}

/**
 * Analyzes the blocks in the workspace to generate educational hints.
 */
export function analyzeWorkspace(blocks: { type: string; fields?: Record<string, string> }[]): CodeHint[] {
  const hints: CodeHint[] = []
  
  const hasBlockType = (type: string) => blocks.some(b => b.type === type)
  
  // 1. time_delay -> warning
  if (hasBlockType('time_delay')) {
    hints.push({
      id: 'hint-time-delay',
      level: 'warning',
      message: 'Consider using millis() for non-blocking delays instead of delay().',
      icon: '⏱️'
    })
  }
  
  // 2. serial_print without serial_begin -> error
  if (hasBlockType('serial_print') && !hasBlockType('serial_begin')) {
    hints.push({
      id: 'hint-serial-begin',
      level: 'error',
      message: 'Add Serial.begin(9600) in setup before using Serial.print',
      icon: '🔌'
    })
  }
  
  // 3. Empty setup block (no pinMode) -> info
  if (!hasBlockType('io_pinmode')) {
    hints.push({
      id: 'hint-empty-setup',
      level: 'info',
      message: 'Add pinMode() to configure your pins',
      icon: 'ℹ️'
    })
  }
  
  // 5. No loop content -> info
  const execTypes = ['io_digitalwrite', 'io_analogwrite', 'time_delay', 'serial_print']
  const hasExec = blocks.some(b => execTypes.includes(b.type))
  if (!hasExec && blocks.length > 0) {
    hints.push({
      id: 'hint-empty-loop',
      level: 'info',
      message: 'Your loop() is empty — add blocks to run repeatedly',
      icon: '🔄'
    })
  }
  
  // 4 & 6. Pin connections and resistors
  blocks.forEach((block, index) => {
    if (block.type === 'io_digitalwrite') {
      const pin = block.fields?.['PIN'] || 'unknown'
      const connected = block.fields?.['CONNECTED_COMPONENT']
      const hasResistor = block.fields?.['HAS_RESISTOR'] === 'true'
      
      if (!connected || connected === 'none') {
        hints.push({
          id: `hint-unconnected-pin-${pin}-${index}`,
          level: 'warning',
          message: `Pin ${pin} has nothing connected`,
          icon: '⚠️'
        })
      } else if (connected === 'led' && !hasResistor) {
        hints.push({
          id: `hint-no-resistor-pin-${pin}-${index}`,
          level: 'error',
          message: `LED on pin ${pin} needs a current-limiting resistor`,
          icon: '🔥'
        })
      }
    }
  })
  
  return hints
}
