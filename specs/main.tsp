import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

@service(#{ title: "Calendar Calls API" })
namespace CalendarCalls;

/** Successful application health check. */
model HealthResponse {
  status: "ok";
}

/** Check whether the application responds. */
@tag("Health")
@route("/api/health")
@get
op getHealth(): {
  @statusCode statusCode: 200;
  @body body: HealthResponse;
};
