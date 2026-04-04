package com.cloudxplorer.flightservice.infrastructure;

import io.agroal.api.AgroalDataSource;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class FlightDatabaseInitializer {

  private final AgroalDataSource dataSource;
  private final boolean initEnabled;
  private final String scriptPath;

  public FlightDatabaseInitializer(
      AgroalDataSource dataSource,
      @ConfigProperty(name = "flight.db.init.enabled", defaultValue = "false") boolean initEnabled,
      @ConfigProperty(name = "flight.db.init.script", defaultValue = "db/init-flight-db.sql")
          String scriptPath) {
    this.dataSource = dataSource;
    this.initEnabled = initEnabled;
    this.scriptPath = scriptPath;
  }

  void onStart(@Observes StartupEvent ignored) {
    if (!initEnabled) {
      return;
    }

    String script = loadScript(scriptPath);
    try (var connection = dataSource.getConnection();
        var statement = connection.createStatement()) {
      for (String sql : splitStatements(script)) {
        if (sql.isBlank()) {
          continue;
        }
        statement.execute(sql);
      }
    } catch (Exception ex) {
      throw new IllegalStateException("failed to initialize flight database from script: " + scriptPath, ex);
    }
  }

  private String loadScript(String path) {
    try (var input = Thread.currentThread().getContextClassLoader().getResourceAsStream(path)) {
      if (input == null) {
        throw new IllegalStateException("db init script not found on classpath: " + path);
      }
      return new String(input.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException ex) {
      throw new IllegalStateException("failed to read db init script: " + path, ex);
    }
  }

  private Iterable<String> splitStatements(String script) {
    return java.util.Arrays.stream(
            script.lines()
        .map(String::trim)
        .filter(line -> !line.isBlank())
        .filter(line -> !line.startsWith("--"))
        .reduce((left, right) -> left + "\n" + right)
        .orElse("")
        .split(";"))
        .map(String::trim)
        .toList();
  }
}
