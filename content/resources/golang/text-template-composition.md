---
title: "Golang Templates, Part 1: Concepts and Composition"
slug: golang-templates-1
summary: "Understanding Golang Template Nesting and Hierarchy With Simple Text Templates"
date: 2020-12-10
weight: 2
---
## Template Composition Concepts

Go takes a unique approach to defining, loading, and rendering text and HTML templates.

Common templating libraries such as Jinja, Django Templates, or Liquid have OOP-style template hierarchies where one template inherits from or extends another, forming a clear parent-child relationship.
See [Jinja2's template inheritance docs](https://jinja.palletsprojects.com/en/latest/templates/#template-inheritance) for a basic HTML example.

While the Go template philosophy requires a different mental model, it is quite straightforward and flexible once we push past the initial learning curve.

To understand Go stdlib templates, we need to grasp two design decisions of the library:

1. **Any template can embed any other template**
2. **The `Template` type is a recursive collection of `Template` instances**

We will illustrate these concepts with some basic text examples, modified from the Go `text/template` documentation to provide more insight into the inner workings of the library.

Part 2 of this guide will extend these basics to more practical HTML examples.

## The Template Data Structure

As mentioned, Go's `Template` is a recursive data type.
Each `Template` instance is itself a collection made up of one or more `Template` instances.
This structure is represented internally by the `parse.Tree` type.

In this data structure, a child template can be embedded into multiple parent templates.
The `template` libraries handle this internally by copying the child templates.

Introducing cycles into this structure (i.e. `T1` embeds `T2`, which in turn embeds `T1`), is forbidden and will result in errors when building the template collection.

In our following examples:

* T1 is a `Template` instance
* T2 is a `Template` instance
* T3 is a `Template` instance which embeds the T1 & T2 `Template` instances
* The top-level collection, named "tmplEx1", is a `Template` instance that contains the T1, T2, and T3 `Template` instances

A rough representation of this template tree might look like this:

```text
tmplEx1
    ├── T1
    ├── T2
    └── T3
        ├── T1
        └── T2
```

From this collection, we will be able to execute any of the individual templates defined in the collection, or the full collection (really the root of the template tree) at once.

## Declaring and Invoking Templates

### Using `define` and `template`

In Go we declare templates with the `define` action and "invoke" or evaluate them with the `template` action.

The code for building and executing the template collections is contained in sections below.
For now, we will just focus on understanding the outputs we can expect from given inputs.

In the first version of our example, we declare three templates:

* `T1`, containing the word "ONE"
* `T2`, containing the word "TWO"
* `T3`, which invokes `T1` and `T2` with a space in between to say "ONE TWO"

```golang
// Example v1.0
// define T1
t1 := `{{define "T1"}}ONE{{end}}`
// define T2
t2 := `{{define "T2"}}TWO{{end}}`
// define T3, which invokes T1 & T2
t3 := `{{define "T3"}}{{template "T1"}} {{template "T2"}}{{end}}`
```

Rendering these templates with some helpful print statements will give us the following output:

```shell
executing T1 Template: ONE
executing T2 Template: TWO
executing T3 Template: ONE TWO
executing full Template collection: 
```

This looks good, except that executing the full template collection does not output anything.
This is because nowhere in our template collection did we invoke a template outside of a template declaration.

We can correct this (if desired) by invoking the `t3` template somewhere in our collection, outside of any other template definitions.
We will pack the invocation `{{template "T3"}}` in tight at the end to avoid any unwanted whitespace in our template.

```golang
// Example v1.1
...
// define T3, which invokes T1 & T2, then invokes itself
t3 := `{{define "T3"}}{{template "T1"}} {{template "T2"}}{{end}}{{template "T3"}}`
```

Now we will get the desired output:

```shell
executing T1 Template: ONE
executing T2 Template: TWO
executing T3 Template: ONE TWO
executing full Template collection: ONE TWO
```

Now executing the full template collection has an output.

### Using `block`

We can clean up Example v1.1 with the `block` action, which combines the `define` and `template` actions, declaring the template and invoking it in-place.

The `block` action requires a pipeline, but this example does not pass in any meaningful data when executing our template - you will notice the calls to `Execute` just provide an empty string to fill the `data` parameter.

Pipelines provide ways to access and manipulate the Go data structures which can be passed into templates.
Beyond this, pipelines are a topic in and of themselves which will put off in favor of grasping the basic usage of the template package.

We are not concerned with passing any data into the templates in this example.
We will just use the standard "dot" (`.`) pipeline, which passes the provided data through to the template unmodified.

```golang
// Example v1.2
...
// define T3 with block, which invokes T1 & T2, then invokes itself in place
t3 := `{{block "T3" .}}{{template "T1"}} {{template "T2"}}{{end}}`
```

We will get the same output as above, without having to worry about tacking on a `template` invocation without adding whitespace:

```shell
executing T1 Template: ONE
executing T2 Template: TWO
executing T3 Template: ONE TWO
executing full Template collection: ONE TWO
```

## Building a Template Collection

Recall that our template tree looks approximately like this:

```text
tmplEx1
    ├── T1
    ├── T2
    └── T3
        ├── T1
        └── T2
```
When building the template collection, you do not need to worry about parsing the templates in reference order.
Go's `template` packages allow you to add template `T3` to the collection before the others.

This is a flexible approach, as the necessary templates could theoretically be created and added to the collection at anytime in the application lifecycle.
It also removes the burden from the user of building the collection by walking the tree in the correct order.

Templates are generally built on application startup, which is why we use `template.Must` to panic if there are any issues with parsing and building the template collection.

```golang
// instantiate new template.Template collection
tmplEx1 := template.New("tmplEx1")

// build template collection by iteratively parsing the
// templates, using Must to panic on any errors
tmplEx1 = template.Must(tmplEx1.Parse(t1))
tmplEx1 = template.Must(tmplEx1.Parse(t2))
tmplEx1 = template.Must(tmplEx1.Parse(t3))

// Print out the names of all templates in the collection
fmt.Println(tmplEx1.DefinedTemplates())
```

Output:

```shell
; defined templates are: "T2", "T3", "T1", "tmplEx1"  # names are not in any particular order
```

## Executing Templates

Template collections can be executed as a whole from the root of the tree with the `Execute` method, or a specific template in the collection can be referenced by name with `ExecuteTemplate`.

This snippet will execute the templates built in the examples above to produce the expected output:

```golang
fmt.Print("\nexecuting T1 Template: ")
err := tmplEx1.ExecuteTemplate(os.Stdout, "T1", "")
if err != nil {
	fmt.Println(err)
}

fmt.Print("\nexecuting T2 Template: ")
err = tmplEx1.ExecuteTemplate(os.Stdout, "T2", "")
if err != nil {
	fmt.Println(err)
}

fmt.Print("\nexecuting T3 Template: ")
err = tmplEx1.ExecuteTemplate(os.Stdout, "T3", "")
if err != nil {
	fmt.Println(err)
}

fmt.Print("\nexecuting full Template collection: ")
// Since the root template has name "tmplEx1", this is the same as calling
// tmplEx1.ExecuteTemplate(os.Stdout, "tmplEx1", "")
err = tmplEx1.Execute(os.Stdout, "")
if err != nil {
	fmt.Println(err)
}
```
