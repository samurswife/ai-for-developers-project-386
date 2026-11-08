import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

@service(#{ title: "Calendar Calls API" })
@doc("HTTP API for the calendar calls application.")
@server("http://127.0.0.1:3000", "Local development server")
namespace CalendarCalls;

/** Successful application health check. */
@example(#{ status: "ok" })
model HealthResponse {
  @example("ok")
  status: "ok";
}

/** Check whether the application responds. */
@tag("Health")
@route("/api/health")
@get
@opExample(#{ returnType: #{ statusCode: 200, body: #{ status: "ok" } } })
op getHealth(): {
  @statusCode statusCode: 200;
  @body body: HealthResponse;
};

/** Published meeting type. */
@example(#{
  id: "7d09f511-e6bb-4fda-8b7a-5602543d6790",
  name: "Знакомство",
  description: "",
  durationMinutes: 30,
})
model MeetingType {
  /** Server-assigned UUID. */
  @example("7d09f511-e6bb-4fda-8b7a-5602543d6790") @format("uuid") id: string;

  /** Plain-text title, trimmed by the server. */
  @example("Знакомство")
  @minLength(1)
  @maxLength(100)
  name: string;

  /** Optional details, empty when omitted at creation. */
  @example("") @maxLength(2000) description: string;

  /** Meeting duration in minutes. */
  @example(30)
  @minValue(1)
  @maxValue(540)
  durationMinutes: int32;
}

/** Fields accepted when creating a meeting type. */
@example(#{ name: "Знакомство", durationMinutes: 30 })
model CreateMeetingTypeRequest {
  /** Plain-text title; 1–100 characters after surrounding whitespace is removed. */
  @example("Знакомство") name: string;

  /** Optional plain-text details. */
  @example("") @maxLength(2000) description?: string;

  /** Whole number of minutes. */
  @example(30)
  @minValue(1)
  @maxValue(540)
  durationMinutes: int32;
}

/** A field that must be corrected. */
@example(#{
  field: "name",
  code: "VALIDATION_ERROR",
  message: "Введите название.",
})
model FieldError {
  /** Request field, or body for an invalid object. */
  @example("name") field: string;

  /** Machine-readable reason. */
  @example("VALIDATION_ERROR") code: string;

  /** Human-readable explanation. */
  @example("Введите название.") message: string;
}

/** Invalid request data. */
@error
model ValidationError {
  @statusCode statusCode: 400;
  @body body: {
    /** Machine-readable reason. */
    @example("VALIDATION_ERROR") code: "VALIDATION_ERROR";

    /** Human-readable explanation. */
    @example("Проверьте поля запроса.") message: string;

    /** Fields to correct. */
    @example(#[
      #{ field: "name", code: "VALIDATION_ERROR", message: "Введите название." }
    ])
    fieldErrors?: FieldError[];
  };
}

/** Unexpected server failure; a write may already have succeeded. */
@error
model InternalError {
  @statusCode statusCode: 500;
  @body body: {
    /** Machine-readable reason. */
    @example("INTERNAL_ERROR") code: "INTERNAL_ERROR";

    /** Human-readable explanation. */
    @example("Не удалось выполнить запрос.") message: string;

    /** Optional field details. */
    @example(#[]) fieldErrors?: FieldError[];
  };
}

@tag("MeetingTypes")
@route("/api/meeting-types")
namespace MeetingTypes {
  /** List meeting types in creation order, oldest first. */
  @get
  @opExample(#{ returnType: #{ statusCode: 200, body: #{ items: #[] } } })
  @opExample(#{
    returnType: #{
      statusCode: 500,
      body: #{
        code: "INTERNAL_ERROR",
        message: "Не удалось выполнить запрос.",
      },
    },
  })
  op listMeetingTypes():
    | {
        @statusCode statusCode: 200;
        @body body: {
          /** All published meeting types. */
          @example(#[]) items: MeetingType[];
        };
      }
    | InternalError;

  /** Publish a meeting type. Extra fields and null values are rejected. */
  @post
  @opExample(#{
    parameters: #{ body: #{ name: "Знакомство", durationMinutes: 30 } },
    returnType: #{
      statusCode: 201,
      body: #{
        id: "7d09f511-e6bb-4fda-8b7a-5602543d6790",
        name: "Знакомство",
        description: "",
        durationMinutes: 30,
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 400,
      body: #{
        code: "VALIDATION_ERROR",
        message: "Проверьте поля запроса.",
        fieldErrors: #[
          #{
            field: "name",
            code: "VALIDATION_ERROR",
            message: "Введите название.",
          }
        ],
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 500,
      body: #{
        code: "INTERNAL_ERROR",
        message: "Не удалось выполнить запрос.",
      },
    },
  })
  op createMeetingType(
    @doc("Meeting type fields supplied by the owner.")
    @body
    body: CreateMeetingTypeRequest,
  ):
    | {
        @statusCode statusCode: 201;
        @body body: MeetingType;
      }
    | ValidationError
    | InternalError;
}

/** A meeting type is no longer published or the identifier is unknown. */
@error
model MeetingTypeNotFound {
  @statusCode statusCode: 404;
  @body body: {
    /** Machine-readable reason. */
    @example("MEETING_TYPE_NOT_FOUND") code: "MEETING_TYPE_NOT_FOUND";

    /** Human-readable explanation. */
    @example("Тип встречи не найден.") message: string;

    /** Optional field details. */
    @example(#[]) fieldErrors?: FieldError[];
  };
}

namespace MeetingTypes {
  /** Read a published meeting type by its UUID. */
  @route("/{id}")
  @get
  @opExample(#{
    returnType: #{
      statusCode: 200,
      body: #{
        id: "7d09f511-e6bb-4fda-8b7a-5602543d6790",
        name: "Знакомство",
        description: "",
        durationMinutes: 30,
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 400,
      body: #{ code: "VALIDATION_ERROR", message: "Некорректный ID." },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 404,
      body: #{
        code: "MEETING_TYPE_NOT_FOUND",
        message: "Тип встречи не найден.",
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 500,
      body: #{
        code: "INTERNAL_ERROR",
        message: "Не удалось выполнить запрос.",
      },
    },
  })
  op getMeetingType(
    @doc("Meeting type UUID.")
    @path
    @format("uuid")
    id: string,
  ):
    | {
        @statusCode statusCode: 200;
        @body body: MeetingType;
      }
    | ValidationError
    | MeetingTypeNotFound
    | InternalError;
}

/** UTC instant returned by the server. */
@example("2026-11-09T06:00:00.000Z")
@format("date-time")
@pattern("Z$")
scalar UtcInstant extends string;

/** Calendar date in Europe/Moscow. */
@example("2026-11-09")
@format("date")
scalar MoscowDate extends string;

/** A confirmed guest booking. */
model Booking {
  /** Server-assigned UUID. */
  @example("f07a5448-2aad-4ca2-b809-5589161cfaf4") @format("uuid") id: string;

  /** Referenced meeting type. */
  @example(#{
    id: "7d09f511-e6bb-4fda-8b7a-5602543d6790",
    name: "Знакомство",
    description: "",
    durationMinutes: 30,
  })
  meetingType: MeetingType;

  /** Inclusive UTC start. */
  @example("2026-11-09T06:00:00.000Z") startsAt: UtcInstant;

  /** Exclusive UTC end computed by the server. */
  @example("2026-11-09T06:30:00.000Z") endsAt: UtcInstant;

  /** Trimmed guest name. */
  @example("Анна")
  @minLength(1)
  @maxLength(100)
  guestName: string;

  /** Trimmed email, preserving original spelling. */
  @example("Anna@example.com") @maxLength(254) guestEmail: string;
}

/** Fields accepted for a new booking. Strings are validated by the server. */
model CreateBookingRequest {
  /** Published meeting type UUID. */
  @example("7d09f511-e6bb-4fda-8b7a-5602543d6790")
  @format("uuid")
  meetingTypeId: string;

  /** ISO 8601 instant with Z or numeric offset; invalid strings receive INVALID_TIME. */
  @example("2026-11-09T09:00:00+03:00") startsAt: string;

  /** Name, 1–100 characters after trimming. */
  @example("Анна") guestName: string;

  /** Email, at most 254 characters after trimming. */
  @example("Anna@example.com") guestEmail: string;
}

/** A syntactically valid string that violates the booking time rules. */
@error
model InvalidTime {
  @statusCode statusCode: 400;
  @body body: {
    /** Machine-readable reason. */
    @example("INVALID_TIME") code: "INVALID_TIME";

    /** Explanation of the invalid selection. */
    @example("Выбранное время больше недоступно.") message: string;

    /** Optional field details. */
    @example(#[]) fieldErrors?: FieldError[];
  };
}

/** Another booking overlaps the requested interval. */
@error
model SlotConflict {
  @statusCode statusCode: 409;
  @body body: {
    /** Machine-readable reason. */
    @example("SLOT_CONFLICT") code: "SLOT_CONFLICT";

    /** Explanation of the conflict. */
    @example("Это время уже занято. Выберите другой слот") message: string;

    /** Optional field details. */
    @example(#[]) fieldErrors?: FieldError[];
  };
}

@tag("Bookings")
@route("/api/bookings")
namespace Bookings {
  /** All bookings starting strictly after one captured server instant, earliest first; no booking-window filter. */
  @route("/upcoming")
  @get
  @opExample(#{ returnType: #{ statusCode: 200, body: #{ items: #[] } } })
  @opExample(#{
    returnType: #{
      statusCode: 500,
      body: #{
        code: "INTERNAL_ERROR",
        message: "Не удалось выполнить запрос.",
      },
    },
  })
  op listUpcomingBookings():
    | {
        @statusCode statusCode: 200;
        @body body: {
          /** Upcoming meetings of every type, sorted by start. */
          @example(#[]) items: Booking[];
        };
      }
    | InternalError;

  /** Atomically verify and save a booking in one backend process. No automatic retries. */
  @post
  @opExample(#{
    parameters: #{
      body: #{
        meetingTypeId: "7d09f511-e6bb-4fda-8b7a-5602543d6790",
        startsAt: "2026-11-09T09:00:00+03:00",
        guestName: "Анна",
        guestEmail: "Anna@example.com",
      },
    },
    returnType: #{
      statusCode: 201,
      body: #{
        id: "f07a5448-2aad-4ca2-b809-5589161cfaf4",
        meetingType: #{
          id: "7d09f511-e6bb-4fda-8b7a-5602543d6790",
          name: "Знакомство",
          description: "",
          durationMinutes: 30,
        },
        startsAt: "2026-11-09T06:00:00.000Z",
        endsAt: "2026-11-09T06:30:00.000Z",
        guestName: "Анна",
        guestEmail: "Anna@example.com",
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 400,
      body: #{
        code: "INVALID_TIME",
        message: "Выбранное время больше недоступно.",
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 400,
      body: #{ code: "VALIDATION_ERROR", message: "Проверьте поля запроса." },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 404,
      body: #{
        code: "MEETING_TYPE_NOT_FOUND",
        message: "Тип встречи не найден.",
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 409,
      body: #{
        code: "SLOT_CONFLICT",
        message: "Это время уже занято. Выберите другой слот",
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 500,
      body: #{
        code: "INTERNAL_ERROR",
        message: "Не удалось выполнить запрос.",
      },
    },
  })
  op createBooking(
    @doc("Guest and selected start.") @body body: CreateBookingRequest,
  ):
    | {
        @statusCode statusCode: 201;
        @body body: Booking;
      }
    | ValidationError
    | MeetingTypeNotFound
    | InvalidTime
    | SlotConflict
    | InternalError;
}

/** A computed, unreserved interval for a meeting. */
model Slot {
  /** Inclusive start, strictly after currentTime. */
  @example("2026-11-09T06:00:00.000Z") startsAt: UtcInstant;

  /** Exclusive end, calculated from the meeting duration. */
  @example("2026-11-09T06:30:00.000Z") endsAt: UtcInstant;
}

/** One Moscow date, including dates without free intervals. */
model AvailabilityDay {
  /** Moscow calendar date. */
  @example("2026-11-09") date: MoscowDate;

  /** Free intervals sorted by start. */
  @example(#[]) slots: Slot[];
}

/** All fourteen dates of the current booking window. */
model Availability {
  /** One server instant captured for the entire calculation. */
  @example("2026-11-08T20:59:59.000Z") currentTime: UtcInstant;

  /** Time zone for all calendar rules. */
  @example("Europe/Moscow") timeZone: "Europe/Moscow";

  /** First date, inclusive. */
  @example("2026-11-08") windowStartDate: MoscowDate;

  /** Last date, inclusive. */
  @example("2026-11-21") windowEndDate: MoscowDate;

  /** All fourteen dates in chronological order. */
  @example(#[]) days: AvailabilityDay[];
}

namespace MeetingTypes {
  /** Compute all free slots for a published meeting type. Selecting a slot does not reserve it. */
  @route("/{id}/slots")
  @get
  @opExample(#{
    returnType: #{
      statusCode: 200,
      body: #{
        currentTime: "2026-11-08T20:59:59.000Z",
        timeZone: "Europe/Moscow",
        windowStartDate: "2026-11-08",
        windowEndDate: "2026-11-21",
        days: #[],
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 400,
      body: #{ code: "VALIDATION_ERROR", message: "Некорректный ID." },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 404,
      body: #{
        code: "MEETING_TYPE_NOT_FOUND",
        message: "Тип встречи не найден.",
      },
    },
  })
  @opExample(#{
    returnType: #{
      statusCode: 500,
      body: #{
        code: "INTERNAL_ERROR",
        message: "Не удалось выполнить запрос.",
      },
    },
  })
  op getSlots(
    @doc("Meeting type UUID.")
    @path
    @format("uuid")
    id: string,
  ):
    | {
        @statusCode statusCode: 200;
        @body body: Availability;
      }
    | ValidationError
    | MeetingTypeNotFound
    | InternalError;
}
