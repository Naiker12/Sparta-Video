import { describe, expect, it } from 'vitest'
import { formatRulerTime, formatTimecode, parseTimecode, secondsToFrameNumber } from './timecode'

describe('timecode helpers', () => {
  it('converts seconds to frame numbers at the sequence frame rate', () => {
    expect(secondsToFrameNumber(1.5, 24)).toBe(36)
    expect(secondsToFrameNumber(1.5, 30)).toBe(45)
    expect(secondsToFrameNumber(1.5, 60)).toBe(90)
  })

  it('formats long timecodes with frame fields', () => {
    expect(formatTimecode(65.5, 24)).toBe('00:01:05:12')
    expect(formatTimecode(3661.25, 24)).toBe('01:01:01:06')
  })

  it('keeps negative time at zero and formats ruler labels as minutes:seconds', () => {
    expect(formatTimecode(-3, 24)).toBe('00:00:00:00')
    expect(formatRulerTime(125.9)).toBe('02:05')
  })

  it('parses user-typed timecodes and seconds', () => {
    expect(parseTimecode('00:01:05:12', 24)).toBe(65.5)
    expect(parseTimecode('01:05:12', 24)).toBe(65.5)
    expect(parseTimecode('02:15', 24)).toBe(135)
    expect(parseTimecode('12.5', 24)).toBe(12.5)
    expect(parseTimecode('invalid', 24)).toBeNull()
    expect(parseTimecode('00:00:00:25', 24)).toBeNull() // invalid frame for 24fps
  })
})
