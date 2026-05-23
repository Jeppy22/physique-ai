import {
  projectWeightTrajectory,
  assessMacros,
  generatePeakWeek,
  flagWarningSigns,
} from './index';

export type ToolName =
  | 'project_weight_trajectory'
  | 'assess_macros'
  | 'generate_peak_week'
  | 'flag_warning_signs';

export interface ToolCallResult {
  toolName: ToolName;
  input: unknown;
  output: unknown;
  error?: string;
}

export async function executeTool(
  name: string,
  input: unknown,
): Promise<ToolCallResult> {
  try {
    switch (name) {
      case 'project_weight_trajectory':
        return {
          toolName: name,
          input,
          output: projectWeightTrajectory(input as never),
        };
      case 'assess_macros':
        return {
          toolName: name,
          input,
          output: assessMacros(input as never),
        };
      case 'generate_peak_week':
        return {
          toolName: name,
          input,
          output: generatePeakWeek(input as never),
        };
      case 'flag_warning_signs':
        return {
          toolName: name,
          input,
          output: flagWarningSigns(input as never),
        };
      default:
        return {
          toolName: name as ToolName,
          input,
          output: null,
          error: `Unknown tool: ${name}`,
        };
    }
  } catch (err) {
    return {
      toolName: name as ToolName,
      input,
      output: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
