/**
	A calendar widget by Joshua Claunch

	Dependencies: jQuery and Moment.js
*/
(function(outside, $, moment) {

	var Header = function(calendar, config) {
		this.calendar = calendar
		this.config = config
		this.init()
	}
	Header.prototype = {
		formatRegex: /format\((.*?)\)/g,
		positions: ['left', 'center', 'right'],

		init: function() {
			this.el = $('<header class="cocal-header"></header>')
			this.initPositions()
		},

		initPositions: function() {
			for (var i = 0; i < this.positions.length; i++) {
				var position = this.positions[i]
				if (!this.config[position]) continue

				var positionEl = this.parseConfig(position, this.config[position])

				this.el.append(positionEl)
			}
		},

		parseConfig: function(position, items) {
			if (!Array.isArray(items)) throw new TypeError('Company Calendar Error: header item at position "' + position + '" must be an array')
			var container = $('<div class="cocal-header-' + position + '"></div>'),
				date = this.calendar.date

			for (var i = 0; i < items.length; i++) {
				var item = items[i],
					pair = item.split('::'),
					html = pair.shift().trim(),
					command = pair.length && pair.shift().trim()

				if (this.formatRegex.test(html)) {
					html = html.replace(this.formatRegex, function(match, capture) { return date.format(capture) })
				}
				var tagName = command ? 'a' : 'span',
					el = $('<' + tagName + ' class="cocal-header-item">' + html + '</' + tagName + '>')

				if (command) {
					el.on('click', this.calendar.fireCommand.bind(this.calendar, command))
				}
				container.append(el)
			}

			return container
		},

		update: function() {
			this.el.empty()
			this.initPositions() // TODO: make an intelligent diffing system, instead of just rewriting everything on update
		}
	}


	var Week = function(config, date, start, end) {
		this.config = config
		this.date = date
		this.start = start
		this.end = end

		this.init()
	}
	Week.prototype = {
		init: function() {
			this.el = $('<div class="cocal-week"></div>')
			this.initDays(this.config, this.date.clone())
		},

		initDays: function(config, date) {
			this.days = []
			for (var i = 0; i < 7; date.date(date.date() + 1) && i++) {
				if (i === 0 && config.excludeSundays || ~[0, 6].indexOf(i) && config.excludeWeekends) continue

				var day = new Day(date.clone(), date.isBefore(this.start) || date.isAfter(this.end))
				this.days.push(day)
			}
		},

		draw: function() {
			this.el.empty()
			for (var i = 0; i < this.days.length; i++) {
				var day = this.days[i]
				this.el.append(day.draw())
			}
			return this.el
		},

		find: function(date) {
			for (var i = 0; i < this.days.length; i++) {
				var day = this.days[i]
				if (date.isSame(day.date)) return day
			}
		}
	}

	var Day = function(date, isOverflow) {
		this.date = date
		this.isOverflow = isOverflow
		this.events = []
		this.init(date)
	}
	Day.prototype = {
		init: function(date) {
			this.el = $('<div class="cocal-day"></div>')
			if (this.isOverflow) this.el.addClass('cocal-overflow-date')

			var dateNumber = $('<span class="cocal-date-number">' + this.date.format('D') + '</span>')
			if (date.date() === 1) dateNumber.text(date.format('MMMM') + ' ' + dateNumber.text())
			this.el.append(dateNumber)
		},

		draw: function() {
			for (var i = 0; i < this.events.length; i++) {
				var event = this.events[i]
				this.el.append(event.draw())
			}

			return this.el
		}
	}

	var Event = function(body, name, start, end, label, tags) {
		if (!name || !start) throw new Error('Company Calendar Error: malformed event; events must have a name and start time')
		if (typeof name !== 'string') throw new TypeError('Company Calendar Error: event name must be a string')
		if (typeof start !== 'number' && !(start instanceof moment)) throw new TypeError('Company Calendar Error: event start time must be an integer or moment object')
		if (end && typeof end !== 'number' && !(end instanceof moment)) throw new TypeError('Company Calendar Error: event end time must be an integer or moment object')
		if (end && +end < +start) throw new Error('Company Calendar Error: event end time must be after event start time')

		this.body = body
		this.name = name
		this.start = typeof start === 'number' ? moment(start) : start
		if (end) this.end = typeof end === 'number' ? moment(end) : end
		if (label) this.label
		if (tags) this.tags = tags

		this.drawn = false
		this.init()
	}
	Event.prototype = {
		init: function() {
			this.el = $('<div class="cocal-event">' + this.name + '</div>')
			var current = this.start.clone().startOf('day'),
				end = this.end ? this.end.clone().startOf('day') : current.clone()

			// Add this event to all the corresponding Day objects
			while (current.isSameOrBefore(end)) {
				var currentDay = this.body.findDay(current)
				if (!currentDay) {
					current.date(current.date() + 1)
					continue // Date is out of range of the current calendar view range
				}

				currentDay.events.push(this)
				current.date(current.date() + 1)
			}
		},

		draw: function() {
			var drawn = this.drawn
			this.drawn = true
			window.setTimeout(function() {
				this.drawn = false
			})
			return drawn ? $('<div class="cocal-event-line"></div>') : this.el
		}
	}


	var Body = function(calendar, config) {
		if (config.monthStart < 1) config.monthStart = 1
		config.weekStart = Math.max(0, Math.min(6, config.weekStart - 1))

		this.calendar = calendar
		this.config = config
		this.init()
	}
	Body.prototype = {
		init: function() {
			this.el = $('<main class="cocal-body"></main>')
			if (!this.config.edgeBorders) this.el.addClass('cocal-sans-edge-borders')
			this.initWeeks(this.config)
			this.initEvents(this.config.events || [])
			this.draw()
		},

		initEvents: function(events) {
			if (!Array.isArray(events)) throw new TypeError('Company Calendar Error: events must be an array')

			this.events = []
			for (var i = 0; i < events.length; i++) {
				var event = events[i]
				if (typeof event !== 'object') throw new TypeError('Company Calendar Error: event must be an object')
				this.events.push(new Event(this, event.name, event.start, event.end, event.label, event.tags))
			}
		},

		initWeeks: function(config) {
			this.weeks = []

			var start = this.calendar.date.clone().date(config.monthStart)

			if (start.month() !== this.calendar.date.month()) start.month(start.month() - 1).endOf('month')
			if (start.isAfter(this.calendar.date)) start.month(start.month() - 1)

			var end = start.clone().month(start.month() + 1)
			end.date(end.date() - 1)

			var actualStart = start.clone().day(config.weekStart),
				actualEnd = end.clone().day((config.weekStart + 6) % 7)

			if (actualStart.isAfter(start)) actualStart.date(actualStart.date() - 7)
			if (actualEnd.isBefore(end)) actualEnd.date(actualEnd.date() + 7)

			while (actualStart.isBefore(actualEnd)) {
				var week = new Week(config, actualStart.clone(), start, end)
				this.weeks.push(week)
				actualStart.date(actualStart.date() + 7)
			}
		},

		draw: function() {
			this.el.empty()
			this.el.append(this.drawDaynamesRow(this.config))
			for (var i = 0; i < this.weeks.length; i++) {
				var week = this.weeks[i]
				this.el.append(week.draw())
			}
			return this.el
		},

		drawDaynamesRow: function(config) {
			if (!config.dayNames) return // the user doesn't want these

			var row = $('<div class="cocal-daynames"></div>'),
				date = moment().startOf('week')

			for (var i = 0; i < 7; date.date(date.date() + 1) && i++) {
				row.append('<div class="cocal-dayname">' + date.format('ddd') + '</div>')
			}
			return row
		},

		findDay: function(date) {
			for (var i = 0; i < this.weeks.length; i++) {
				var week = this.weeks[i],
					weekEnd = week.date.clone()

				weekEnd.date(weekEnd.date() + 6)
				if (date.isBefore(week.date) || date.isAfter(weekEnd)) continue

				return week.find(date)
			}
		},

		update: function() {
			this.el.empty()
			this.initWeeks(this.config) // TODO: make an intelligent diffing system, instead of just rewriting everything on update
			this.initEvents(this.config.events || [])
			this.draw()
		}
	}


	var commands = {
		prev: function() {
			this.prev()
		},
		next: function() {
			this.next()
		}
	}
	var defaultConfig = function() {
		return {
			date: moment(),
			dayHeight: '200px',
			dayNames: true,
			edgeBorders: true,
			events: [],
			monthStart: 1,
			weekStart: 1
		}
	}

	/**
		Calendar -- The interface the user will actually work with
		Options:
			date -- int|moment [default: now] -- The date that will be selected by default.
			dayHeight -- string [default: '200px'] -- The height of a day in any css unit.
			dayNames -- bool [default: true] -- Whether to display the names of the days of the week (e.g. Sunday, Monday) at the top of the calendar.
			edgeBorders -- bool [default: true] -- Whether the borders on the outside of the calendar should be displayed
			events -- array [optional] -- A list of event objects. Event object properties:
				name -- string [required] -- The name of this event
				start -- int|moment [required] -- The start time of this event
				end -- int|moment [optional] -- The end time of this event
				label -- string [optional] -- The label to give this event. A class 'label-[labelname]' will be added to the event
				tags -- array [optional] -- A list of strings to tag this event with. A span with class 'tag-[tagname]' will be appended to the event for each tag.
			excludeWeekends -- bool [default: false] -- Set to true if weekends should not be displayed.
			excludeSundays -- bool [default: false] -- Set to true if Sundays should not be displayed.
			header -- object [optional] -- Specify what should be shown in the header of the calendar. 'left', 'center', and 'right' properties may be specified. Each property takes an array like so:
					['Prev::prev', '<i class="fa fa-arrow-right"></i> :: next', 'format(ddd, DD)']
					A double colon separates each string into html/command pairs.
					The command is optional.
					The format() 'function' is a special helper. It will output the moment.js format of the currently selected calendar day. Everything in the `()` will be passed to moment's format() function.
					Custom commands may be supplied via the 'addCommand' method. The native commands are:
				next -- A button that, when clicked, will call the next() function on this calendar object.
				prev -- A button that, when clicked, will call the prev() function on this calendar object.
			monthStart -- int [default: 1] (range: 1-31) -- The day of the month that the month starts on (e.g. to display from Mar 15 to Apr 14, set this to 15). If out of range (e.g. 30 in Feb), will be the last day of the month.
			weeks -- int [optional] -- A fixed number of weeks to display. If not specified, this will vary based on the length of the current month.
			weekStart -- int [default: 1] (range: 1-7) -- The day of the week that a week starts on. 1 = Sunday, and so on.
	*/
	var Calendar = function(config) {
		this.config = $.extend({}, defaultConfig(), config)
		this.date = this.config.date
		if (typeof this.date === 'number') this.date = moment()
		this.date.startOf('day')

		this.init()
	}
	Calendar.prototype = {
		init: function() {
			this.el = $('<div class="cocal"></div>')
			this.initHeader(this.config.header)
			this.initBody(this.config)
		},

		initBody: function(config) {
			this.body = new Body(this, config)
			this.el.append(this.body.el)
		},

		initHeader: function(config) {
			if (!config) return // the header is optional; don't put one in if they didn't specify config for one
			this.header = new Header(this, config)
			this.el.append(this.header.el)
		},

		fireCommand: function(command) {
			if (!commands[command]) return

			return commands[command].call(this)
		},

		next: function() {
			this.date.month(this.date.month() + 1)
			this.update()
		},

		prev: function() {
			this.date.month(this.date.month() - 1)
			this.update()
		},

		update: function() {
			this.header.update()
			this.body.update()
		}
	}


	// Expose a factory for easy creation of Calendar objects
	var cocal = outside.cocal = function(config) {
		var calendar = new Calendar(config || {})

		if (config.selector) {
			$el = $(selector)
			if (!$el.length) throw new Error('Company Calendar Error: no elements found matching the given selector')

			$el.append(calendar.el)
		}
		return calendar
	}

	cocal.addCommand = function(command, func) {
		commands[command] = func
	}
})(this, jQuery, moment)
