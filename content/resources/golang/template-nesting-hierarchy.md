---
title: "Golang Templates Part 1: Concepts and Composition with Text Templates"
slug: golang-templates-1
summary: "Understanding Golang's template nesting and hierarchy with basic text templates"
date: 2020-12-10
lastmod: 2021-01-09
order_number: 1
---

## Template Composition Concepts

Go's templating system can be quite confusing and tricky at first.

Defining, parsing, and rendering the templates you want is likely to be unintuitive for anyone coming from common templating libraries such as Jinja, Django Templates, or Liquid. These libraries have OOP-style template hierarchies where one template inherits from or extends another, forming a parent-child relationship. See [Jinja2's template inheritance docs](https://jinja.palletsprojects.com/en/2.11.x/templates/#template-inheritance) for a basic HTML example.

To understand Go stdlib templates, we need to grasp two design decisions of the library:

1. **Any template can embed any other template**

2. **The `Template` type is a recursive collection of `Template` instances**


We will illustrate these concepts with some basic text examples, modified from the Go `text/template` documentation to provide more insight into the inner workings of the library.

Part 2 of this guide will extend these basics to more practical HTML examples.

## Declaring and Invoking Templates

### Using `define` and `template`

In Go we declare templates with the `define` action and "invoke" or evaluate them with the `template` action. In the first version of example, we declare three templates:
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

This will give us the output:

```shell
executing T1 Template: ONE
executing T2 Template: TWO
executing T3 Template: ONE TWO
executing full Template collection: 
```

This looks good except that executing the full template collection does not output anything. This is because nowhere in our templates did we invoke a template outside of a template declaration.

We can correct this (if desired) by invoking the `t3` template somewhere in our collection, outside of any other template definitions. We will pack the invocation `{{template "T3"}}` in tight at the end to avoid any unwanted whitespace in our template.

```golang
// Example v1.1
...
// define T3, which invokes T1 & T2, then invokes itself
t3 := `{{define "T3"}}{{template "T1"}} {{template "T2"}}{{end}}{{template "T3"}}`
```

Now we would get the desired output:

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

Pipelines provide ways to access and manipulate the data passed in. Since we are not using the data, it does not much matter which pipeline we choose here. We will just use the `.` pipeline, which just passes the provided data through to the template unmodified - a decent placeholder if you may want to pass data in later.

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

As mentioned, Go's `Template` is a recursive data type, meaning that each instance is a collection made up of one or more `Template` instances. This structure is represented by the `parse.Tree` type, although in practice it acts as a graph rather than a tree.

In our example:
* T1 is a `Template` instance
* T2 is a `Template` instance
* T3 is a `Template` instance that contains the T1 & T2 `Template` instances
* The top-level collection, named "tmplEx1" from our call to `New`, is a `Template` instance that contains the T1, T2, and T3 `Template` instances

A rough representation of this template tree might look like this:

```text
tmplEx1
    ├── T1
    ├── T2
    └── T3
        ├── T1
        └── T2
```

From this collection, we will be able to execute any of the individual templates defined in the collection, or the whole collection (really the root of the template tree) at once.

Templates are generally going to be built on application startup, which is why we are okay with using `template.Must` to panic if there are any issues with parsing and building the template collection.

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
