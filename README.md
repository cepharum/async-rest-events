# event-pull

This module implements promise-based event dispatching intended for use in a REST service with some identifiable clients pulling requests to be emitted by other requests.

## License

MIT

## Install

```
npm i event-pull
```

## Usage

The library offers pool of events emitted for dispatching to particular recipients that have to pull events one by one. Emitters might be notified on recipient having fetched available event. On the opposite end the receiver might pull for another event "blocking" while waiting for some event if there is no pending event.

The intention is to reverse order of processing in a client-server setup. Clients might request server for pulling events targeted at the requesting client. Different parties might use requests on the same server to emit events basically without caring whether the selected recipient is currently available or not, though knowing that any emitted event is dispatched to the recipient as soon as he gets back for pulling another pending event.

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
};
```

* `maxPendingEvents` limits number of pending events per recipient. This limit results in promise returned on emitting event targeting either recipient to be rejected with no further event being added to the queue of pending events. Use `Infinity` to disable this limit.

### Emit Events

Emitting events is as simple as this:

```javascript
sharedPool.emit( "someRecipientId", "eventName", "arg1", 2 )
	.then( () => {
		// TODO add code to run when event has been pull by recipient
	} );
```

This example is emitting event for recipient addressed by its ID `someRecipientId`. This ID can be chosen arbitrarily. The event is named `eventName` and it is customized using arguments `"arg1"` and `2`.

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
