# event-pull

This module implements promise-based event dispatching intended for use in a REST service with some identifiable clients pulling requests to be emitted by other requests.

## License

MIT

## Install

```
npm i event-pull
```

## Usage

The library offers pool of events emitted for dispatching to particular recipients that have to pull events one by one. Emitters might be notified on recipient having pulled available event. On the opposite end the receiver might pull for another event "blocking" while waiting for some event if there is no pending event.

The intention is to reverse order of processing in a client-server setup. Clients might request server for pulling events targeted at the requesting client. Different parties might use requests on the same server to emit events basically without caring whether the selected recipient is currently available or not, though knowing that any emitted event is dispatched to the recipient as soon as he gets back for pulling another pending event.

:::warning Important  
It is very important to see the difference between events implemented by this module and those events used by Node.js natively to support implementation of asynchronous code. Every event managed by means of this module is controlled by class that is deriving from [EventEmitter](https://nodejs.org/dist/latest-v8.x/docs/api/events.html#events_class_eventemitter) of Node.js. Thus, when working with events emitted in context of this module it is possible to to emit Node events on either such emitted event.

To resolve this confusing context we call the events implemented by this module simply _events_ while referring to the events natively provided by Node.js as _Node.js events_.  
:::

### Create the Pool

Create the pool on server:

```javascript
const { EventPool } = require( "event-pull" );

const sharedPool = new EventPool();
```

When constructing new pool options might be passed in first argument to customize the pool's behaviour. The default options are:

```
const DefaultOptions = {
	maxPendingEvents: 100,
	pendingTimeout: Infinity,
	handlingTimeout: Infinity,
};
```

* `maxPendingEvents` limits number of pending events per recipient. This limit results in promise returned on emitting event targeting either recipient to be rejected with no further event being added to the queue of pending events. Use `Infinity` to disable this limit.
* `pendingTimeout` defines milliseconds to wait per emitted event to be pulled by its designated recipient. This timeout is managed starting with emitting, thus creating the event.
* `handlingTimeout` defines milliseconds to wait per pulled event to be marked as finished by its handling recipient. This timeout is managed starting with event being actually pulled by its recipient.

### Emit Events

Emitting events is as simple as this:

```javascript
sharedPool.emit( "someRecipientId", "eventName", "arg1", 2 )
	.then( () => {
		// TODO add code to run when event has been pull by recipient
	} );
```

This example is emitting event for recipient addressed by its ID `someRecipientId`. This ID can be chosen arbitrarily. The event is named `eventName` and it is customized using arguments `"arg1"` and `2`.

:::warning Important  
Events of this module are always emitted in context of a pool. 

```javascript
sharedPool.emit( recipientId, eventName, argument );
```

In opposition to that Node.js events may be emitted in context of either event emitted in context of a pool before.

```javascript
sharedPool.pull( recipientId ).then( event => event.emit( eventName, argument ) );
```
:::

### Pulling Events

On behalf of a recipient another pending event might be pulled like this:

```javascript
sharedPool.pull( "myRecipientId" )
	.then( event => {
		// TODO handle provided event
	} );
```

This example is pulling events on behalf of a recipient using ID `myRecipientId`. Because this is different from the one used in example on emitting event before, this pull won't deliver the event emitted before. Unless there has been some event emitted for the recipient ID given here the pull request is asynchronously "blocking" while waiting for event being emitted in near-term future.

Second argument to `pull()` method might be custom timeout in milliseconds to wait for another event.

### Wait for Event Handled by Recipient

Emitting events as described before the promise returned by `emit()` is resolved as soon as the recipient is pulling the related event. It might be desired to wait for the event to be _handled_ by its recipient. This is available using different method:

```javascript
sharedPool.emitAndWait( "someRecipientId", "eventName", "arg1", 2 )
	.then( result => {
		// TODO add code to run when event has been handled by recipient
	} );
```

This feature does not work implicitly but relies on recipient explicitly marking event as handled by emitting Node.js event `handled` on either pulled event. This might include result of handling event passed as argument there.

```javascript
sharedPool.pull( "someRecipientId" )
	.then( event => {
		// TODO handle the event
		
		event.emit( "handled", result );
	} );
```
