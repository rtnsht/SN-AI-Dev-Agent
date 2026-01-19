/**
 * Unit Tests for Persona Engine Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockServiceNowClient } from '../mocks/sn-client.mock';
import { detectPersonaSchema, detectPersona, setPersonaPreferencesSchema } from '../../src/tools/persona-engine';

describe('Persona Engine', () => {
  let mockClient: MockServiceNowClient;

  beforeEach(() => {
    mockClient = new MockServiceNowClient();
  });

  describe('Schema Validation', () => {
    it('should have valid detect persona schema', () => {
      const parsed = detectPersonaSchema.parse({});
      expect(parsed).toBeDefined();
    });

    it('should accept self-declared persona', () => {
      const personas = ['junior_developer', 'senior_developer', 'admin', 'architect'];
      personas.forEach(persona => {
        const parsed = detectPersonaSchema.parse({
          selfDeclared: persona
        });
        expect(parsed.selfDeclared).toBe(persona);
      });
    });

    it('should accept user ID', () => {
      const parsed = detectPersonaSchema.parse({
        userId: 'admin'
      });
      expect(parsed.userId).toBe('admin');
    });

    it('should have valid set preferences schema', () => {
      const parsed = setPersonaPreferencesSchema.parse({
        persona: 'senior_developer',
        preferences: {
          verbosity: 'standard',
          showExplanations: true,
          showExamples: true,
          guardrailStrictness: 'standard',
          confirmationLevel: 'important',
          codeStyle: 'documented'
        }
      });
      expect(parsed.persona).toBe('senior_developer');
    });
  });

  describe('Persona Detection', () => {
    it('should detect persona based on self-declaration', async () => {
      const result = await detectPersona(
        mockClient as any,
        detectPersonaSchema.parse({
          selfDeclared: 'senior_developer'
        })
      );

      expect(result.success).toBe(true);
      expect(result.detectedPersona).toBeDefined();
    });

    it('should return persona with capabilities', async () => {
      const result = await detectPersona(
        mockClient as any,
        detectPersonaSchema.parse({
          selfDeclared: 'admin'
        })
      );

      expect(result.success).toBe(true);
      expect(result.detectedPersona.capabilities).toBeDefined();
    });

    it('should return persona with guardrail defaults', async () => {
      const result = await detectPersona(
        mockClient as any,
        detectPersonaSchema.parse({
          selfDeclared: 'junior_developer'
        })
      );

      expect(result.success).toBe(true);
      expect(result.detectedPersona.guardrailDefaults).toBeDefined();
    });
  });

  describe('Adaptive Settings', () => {
    it('should include adaptive settings for the persona', async () => {
      const result = await detectPersona(
        mockClient as any,
        detectPersonaSchema.parse({
          selfDeclared: 'senior_developer'
        })
      );

      expect(result.success).toBe(true);
      expect(result.adaptiveSettings).toBeDefined();
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations', async () => {
      const result = await detectPersona(
        mockClient as any,
        detectPersonaSchema.parse({
          selfDeclared: 'architect'
        })
      );

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
    });
  });
});

