# [francoposa.io](https://francoposa.io)

**Editing Hugo site & content**

From root directory:

```shell
hugo server --buildDrafts --disableFastRender
```

**Editing Tailwind CSS**

In root directory of whichever theme is being edited:

```shell
npx tailwindcss -i ./static/css/style.css -o ./static/css/style.tailwind.css --watch
```

Changes are picked up by the hugo server process running,
but it may take a few hard refreshes for the browser to display them.
