package com.cloudxplorer.flightservice.domain;

public enum ActorType {
  CUSTOMER,
  CORP;

  public static ActorType fromHeader(String value) {
    return fromContext(value, null);
  }

  public static ActorType fromContext(String actorTypeHeader, String realmHeader) {
    if ("corp".equalsIgnoreCase(trim(actorTypeHeader))) {
      return CORP;
    }
    if ("customer".equalsIgnoreCase(trim(actorTypeHeader))) {
      return CUSTOMER;
    }

    String realm = trim(realmHeader);
    if ("corp".equalsIgnoreCase(realm) || "voyagevibes-corp".equalsIgnoreCase(realm)) {
      return CORP;
    }
    return CUSTOMER;
  }

  public String headerValue() {
    return name().toLowerCase();
  }

  private static String trim(String value) {
    return value == null ? "" : value.trim();
  }
}
