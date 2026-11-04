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
