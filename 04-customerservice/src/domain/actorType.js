const ActorType = Object.freeze({
  CUSTOMER: 'customer',
  CORP: 'corp'
});

function trim(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function actorTypeFromContext(actorTypeHeader, realmHeader) {
  const actorType = trim(actorTypeHeader).toLowerCase();
  if (actorType === ActorType.CORP) {
    return ActorType.CORP;
  }
  if (actorType === ActorType.CUSTOMER) {
    return ActorType.CUSTOMER;
  }

  const realm = trim(realmHeader).toLowerCase();
  if (realm === 'corp' || realm === 'voyagevibes-corp') {
    return ActorType.CORP;
  }

  return ActorType.CUSTOMER;
}

function actorTypeFromHeader(value) {
  return actorTypeFromContext(value, null);
}

module.exports = { ActorType, actorTypeFromHeader, actorTypeFromContext };
