import { z } from "zod";
import { ResponseFormat } from "../constants.js";

export const ListCalendarsSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for structured data")
}).strict();

export type ListCalendarsInput = z.infer<typeof ListCalendarsSchema>;

export const CreateCalendarSchema = z.object({
  name: z.string()
    .refine(name => name.trim().length > 0, "Calendar name is required")
    .describe("Exact name to give the new private calendar")
}).strict();

export type CreateCalendarInput = z.infer<typeof CreateCalendarSchema>;

export const ListEventsSchema = z.object({
  calendar_id: z.string()
    .default("primary")
    .describe("Calendar ID (default: 'primary' for user's main calendar)"),
  time_min: z.string()
    .optional()
    .describe("Start of time range (ISO 8601 format, e.g., '2024-01-01T00:00:00Z')"),
  time_max: z.string()
    .optional()
    .describe("End of time range (ISO 8601 format)"),
  max_results: z.number()
    .int()
    .min(1)
    .max(250)
    .default(10)
    .describe("Maximum events to return (1-250)"),
  query: z.string()
    .optional()
    .describe("Free text search terms to find events"),
  single_events: z.boolean()
    .default(true)
    .describe("Whether to expand recurring events into instances"),
  order_by: z.enum(["startTime", "updated"])
    .default("startTime")
    .describe("Sort order (requires single_events=true for 'startTime')"),
  page_token: z.string()
    .optional()
    .describe("Token for pagination"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' or 'json'")
}).strict();

export type ListEventsInput = z.infer<typeof ListEventsSchema>;

export const GetEventSchema = z.object({
  calendar_id: z.string()
    .default("primary")
    .describe("Calendar ID (default: 'primary')"),
  event_id: z.string()
    .min(1, "Event ID is required")
    .describe("The ID of the event to retrieve"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' or 'json'")
}).strict();

export type GetEventInput = z.infer<typeof GetEventSchema>;

const EventFieldsSchema = z.object({
  summary: z.string().min(1).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start_datetime: z.string().datetime({ offset: true }).optional(),
  end_datetime: z.string().datetime({ offset: true }).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time_zone: z.string().optional(),
  attendees: z.array(z.string().email()).max(100).optional()
}).strict();

function validEventTimes(value: z.infer<typeof EventFieldsSchema>): boolean {
  const timed = Boolean(value.start_datetime || value.end_datetime);
  const allDay = Boolean(value.start_date || value.end_date);
  if (timed && allDay) return false;
  if (timed) return Boolean(value.start_datetime && value.end_datetime);
  if (allDay) return Boolean(value.start_date && value.end_date);
  return true;
}

export const CreateEventSchema = EventFieldsSchema.extend({
  calendar_id: z.string().default("primary")
}).refine(value => Boolean(value.summary && validEventTimes(value) &&
  ((value.start_datetime && value.end_datetime) || (value.start_date && value.end_date))), {
  message: "summary and one complete timed or all-day start/end pair are required"
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = EventFieldsSchema.extend({
  calendar_id: z.string().default("primary"),
  event_id: z.string().min(1)
}).refine(value => validEventTimes(value), {
  message: "supply a complete timed or all-day start/end pair"
}).refine(value => Object.entries(value).some(([key, field]) =>
  !["calendar_id", "event_id"].includes(key) && field !== undefined), {
  message: "at least one event field is required"
});

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

export const DeleteEventSchema = z.object({
  calendar_id: z.string().default("primary"),
  event_id: z.string().min(1)
}).strict();

export type DeleteEventInput = z.infer<typeof DeleteEventSchema>;

export const FreeBusyQuerySchema = z.object({
  time_min: z.string()
    .describe("Start of the time range (ISO 8601 format, e.g., '2024-01-15T00:00:00Z')"),
  time_max: z.string()
    .describe("End of the time range (ISO 8601 format, e.g., '2024-01-22T00:00:00Z')"),
  calendar_ids: z.array(z.string())
    .min(1, "At least one calendar ID or email is required")
    .describe("Array of calendar IDs or email addresses to check (e.g., ['primary', 'colleague@company.com'])"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' or 'json'")
}).strict();

export type FreeBusyQueryInput = z.infer<typeof FreeBusyQuerySchema>;
