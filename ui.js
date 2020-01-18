$(async function() {
	// cache some selectors we'll be using quite a bit
	const $allStoriesList = $("#all-articles-list");
	const $favoritedArticles = $("#favorited-articles");
	// separation
	const $submitForm = $("#submit-form");
	const $filteredArticles = $("#filtered-articles");
	const $loginForm = $("#login-form");
	const $createAccountForm = $("#create-account-form");
	const $ownStories = $("#my-articles");
	const $navLogin = $("#nav-login");
	const $navLogOut = $("#nav-logout");
	const $navWelcome = $("#nav-welcome");
	// global storyList variable
	let storyList = null;

	// global currentUser variable
	let currentUser = null;

	await checkIfLoggedIn();

	/**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

	$loginForm.on("submit", async function(evt) {
		evt.preventDefault(); // no page-refresh on submit

		// grab the username and password
		const username = $("#login-username").val();
		const password = $("#login-password").val();

		// call the login static method to build a user instance
		const userInstance = await User.login(username, password);
		// set the global user to the user instance
		currentUser = userInstance;
		syncCurrentUserToLocalStorage();
		loginAndSubmitForm();
	});

	/**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

	$createAccountForm.on("submit", async function(evt) {
		evt.preventDefault(); // no page refresh

		// grab the required fields
		let name = $("#create-account-name").val();
		let username = $("#create-account-username").val();
		let password = $("#create-account-password").val();

		// call the create method, which calls the API and then builds a new user instance
		const newUser = await User.create(username, password, name);
		currentUser = newUser;
		syncCurrentUserToLocalStorage();
		loginAndSubmitForm();
	});

	/**
   * Log Out Functionality
   */

	$navLogOut.on("click", function() {
		// empty out local storage
		localStorage.clear();
		// refresh the page, clearing memory
		location.reload();
	});

	/**
   * Event Handler for Clicking Login
   */

	$navLogin.on("click", function() {
		// Show the Login and Create Account Forms
		$loginForm.slideToggle();
		$createAccountForm.slideToggle();
		$allStoriesList.toggle();
	});

	/**
   * Event handler for Navigation to Homepage
   */

	$("body").on("click", "#nav-all", async function() {
		hideElements();
		await generateStories();
		$allStoriesList.show();
	});

	/**
   * 
   * Event handler for submit post page
   */

	$("#nav-submit-post").on("click", function() {
		$submitForm.slideToggle();
		$allStoriesList.show();
		$ownStories.hide();
		$favoritedArticles.hide();
	});

	$("#nav-favorites").on("click", function() {
		hideElements();
		$favoritedArticles.empty().show();
		if (currentUser.favorites.length > 0) {
			generateFavoriteStories(currentUser.favorites);
		}
	});

	$("#nav-my-stories").on("click", function() {
		hideElements();
		$ownStories.empty().show();
		if (currentUser.ownStories.length > 0) {
			generateOwnStories(currentUser.ownStories);
		}
	});

	$(".articles-container").on("click", ".fa-star", async function toggleFavorites(e) {
		let selectedStoryId = $(e.target).parent().attr("id");

		$(e.target).toggleClass("far fas");
		const response = isFavorited(selectedStoryId)
			? await currentUser.unfavorite(selectedStoryId)
			: await currentUser.favorite(selectedStoryId);

		response.status === 200 ? updateCurrentUser() : null;
	});

	$ownStories.on("click", ".fa-trash", async function removeStory(e) {
		let selectedStoryId = $(e.target).parent().attr("id");
		let selectedStory = $(e.target).parent();

		let response = await storyList.deleteStory(currentUser.loginToken, selectedStoryId);

		response.status === 200 ? selectedStory.remove() : null;

		updateCurrentUser();
	});

	/*
  SUBMIT FORM 
  */
	$submitForm.submit(async function(e) {
		e.preventDefault();
		let [ author, title, url ] = [ $("#author").val(), $("#title").val(), $("#url").val() ];
		let story = {
			author,
			title,
			url
		};
		let response = await storyList.addStory(currentUser.loginToken, story);

		if (response.status === 201) {
			updateCurrentUser();
		}

		$submitForm.get(0).reset();
		$submitForm.slideToggle();

		generateStories();
	});
	//catchall to refresh current user data for favorites, my stories/deletion
	async function updateCurrentUser() {
		currentUser = await User.getLoggedInUser(currentUser.loginToken, currentUser.username);
	}
	/**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

	async function checkIfLoggedIn() {
		// let's see if we're logged in
		const token = localStorage.getItem("token");
		const username = localStorage.getItem("username");

		// if there is a token in localStorage, call User.getLoggedInUser
		//  to get an instance of User with the right details
		//  this is designed to run once, on page load
		currentUser = await User.getLoggedInUser(token, username);
		await generateStories();

		if (currentUser) {
			showNavForLoggedInUser();
		}
	}

	/**
   * A rendering function to run to reset the forms and hide the login info
   */

	function loginAndSubmitForm() {
		// hide the forms for logging in and signing up
		$loginForm.hide();
		$createAccountForm.hide();

		// reset those forms
		$loginForm.trigger("reset");
		$createAccountForm.trigger("reset");

		// show the stories
		$allStoriesList.show();

		// update the navigation bar
		showNavForLoggedInUser();
	}

	/**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

	async function generateStories() {
		// get an instance of StoryList
		const storyListInstance = await StoryList.getStories();
		// update our global variable
		storyList = storyListInstance;
		// empty out that part of the page
		$allStoriesList.empty();

		// loop through all of our stories and generate HTML for them
		for (let story of storyList.stories) {
			const isFavorite = isFavorited(story.storyId);
			const result = generateStoryHTML(story, isFavorite);
			$allStoriesList.append(result);
		}
	}

	function isFavorited(storyId) {
		return currentUser ? currentUser.favorites.some((favId) => favId.storyId === storyId) : null;
	}
	//GENERATE FAVORITE STORIES
	function generateFavoriteStories(favoriteStories) {
		for (let story of favoriteStories) {
			const isFavorite = isFavorited(story.storyId);
			const result = generateStoryHTML(story, isFavorite);
			$favoritedArticles.append(result);
		}
	}

	//GENERATE MY STORIES
	function generateOwnStories(ownStories) {
		for (let story of ownStories) {
			const isFavorite = isFavorited(story.storyId);
			const result = generateStoryHTML(story, isFavorite, true);
			$ownStories.append(result);
		}
	}

	/**
   * A function to render HTML for an individual Story instance
   */

	function generateStoryHTML(story, isFavorite, isOwn = false) {
		let hostName = getHostName(story.url);
		//starClass "fas" and "far" are font awesome classes.
		// classname fas(solid), for favorites, far(hollow) for others.
		let starClass = isFavorite ? "fas" : "far";
		let removeLink = isOwn ? `<i class="fa fa-trash trash-can" aria-hidden="true"></i>` : "";

		// render story markup
		const storyMarkup = $(`
      <li id="${story.storyId}">
        ${removeLink}
        <i class="${starClass} fa-star"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

		return storyMarkup;
	}

	/* hide all elements in elementsArr */

	function hideElements() {
		const elementsArr = [
			$submitForm,
			$allStoriesList,
			$filteredArticles,
			$ownStories,
			$loginForm,
			$createAccountForm,
			$favoritedArticles
		];
		elementsArr.forEach(($elem) => $elem.hide());
	}

	function showNavForLoggedInUser() {
		$navLogin.hide();
		$navLogOut.show();
		$navWelcome.show();
		$("#crud-actions").show();
		$("#nav-user-profile").text(currentUser.name);
	}

	/* simple function to pull the hostname from a URL */

	function getHostName(url) {
		let hostName;
		if (url.indexOf("://") > -1) {
			hostName = url.split("/")[2];
		} else {
			hostName = url.split("/")[0];
		}
		if (hostName.slice(0, 4) === "www.") {
			hostName = hostName.slice(4);
		}
		return hostName;
	}

	/* sync current user information to localStorage */

	function syncCurrentUserToLocalStorage() {
		if (currentUser) {
			localStorage.setItem("token", currentUser.loginToken);
			localStorage.setItem("username", currentUser.username);
		}
	}
});
