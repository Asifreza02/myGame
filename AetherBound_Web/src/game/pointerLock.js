const pendingRequests = new WeakSet();

export function requestPointerLock(element) {
  if (
    typeof document === 'undefined' ||
    !element ||
    typeof element.requestPointerLock !== 'function' ||
    document.pointerLockElement ||
    pendingRequests.has(element)
  ) {
    return;
  }

  pendingRequests.add(element);
  let request;

  try {
    request = element.requestPointerLock();
  } catch (error) {
    pendingRequests.delete(element);
    if (error?.name !== 'InUseAttributeError') {
      console.warn('Could not lock the pointer:', error);
    }
    return;
  }

  Promise.resolve(request)
    .catch((error) => {
      if (error?.name !== 'InUseAttributeError' && document.pointerLockElement !== element) {
        console.warn('Could not lock the pointer:', error);
      }
    })
    .finally(() => pendingRequests.delete(element));
}
